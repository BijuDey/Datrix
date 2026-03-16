import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/server";

interface PostmanItem {
  name?: string;
  item?: PostmanItem[];
  request?: {
    method?: string;
    url?:
    | string
    | {
      raw?: string;
      protocol?: string;
      host?: string[];
      path?: string[];
      query?: Array<{ key?: string; value?: string }>;
    };
    header?: Array<{ key?: string; value?: string }>;
    body?: {
      mode?: string;
      raw?: string;
    };
  };
}

type PostmanUrlObject = {
  raw?: string;
  protocol?: string;
  host?: string[];
  path?: string[];
  query?: Array<{ key?: string; value?: string }>;
};

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const DEFAULT_IMPORT_URL = "https://api.example.com";

async function getUserAndRole(orgId: string) {
  const supabase = await createUserServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, role: null };

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  return { supabase, user, role: membership?.role ?? null };
}

function flattenPostmanRequests(items: PostmanItem[], bucket: PostmanItem[] = []): PostmanItem[] {
  for (const item of items || []) {
    if (item.request) {
      bucket.push(item);
    }
    if (item.item && item.item.length > 0) {
      flattenPostmanRequests(item.item, bucket);
    }
  }
  return bucket;
}

function parseUrl(url: string | PostmanUrlObject | undefined) {
  if (!url) return "";
  if (typeof url === "string") return url;
  if (url.raw && String(url.raw).trim()) return url.raw;

  const protocol = String(url.protocol || "https").replace(/:$/, "");
  const host = Array.isArray(url.host) ? url.host.filter(Boolean).join(".") : "";
  const path = Array.isArray(url.path) ? `/${url.path.filter(Boolean).join("/")}` : "";
  const query = Array.isArray(url.query)
    ? url.query
      .filter((entry: { key?: string; value?: string }) => entry?.key)
      .map(
        (entry: { key?: string; value?: string }) =>
          `${encodeURIComponent(String(entry.key))}=${encodeURIComponent(String(entry.value || ""))}`
      )
      .join("&")
    : "";

  if (!host) return "";
  const queryPart = query ? `?${query}` : "";
  return `${protocol}://${host}${path}${queryPart}`;
}

function normalizeMethod(method: unknown): string {
  const upper = String(method || "GET").toUpperCase();
  return ALLOWED_METHODS.has(upper) ? upper : "GET";
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const orgId = String(payload.orgId || "");
    const postman = payload.collection;

    if (!orgId || !postman || typeof postman !== "object") {
      return NextResponse.json({ error: "orgId and collection JSON are required" }, { status: 400 });
    }

    const { supabase, user, role } = await getUserAndRole(orgId);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "editor"].includes(String(role))) {
      return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
    }

    const collectionName = String(postman.info?.name || "Imported Postman Collection");

    const { data: newCollection, error: collectionError } = await supabase
      .from("api_collections")
      .insert({
        org_id: orgId,
        name: collectionName,
        description: "Imported from Postman",
        visibility: "org",
        is_imported: true,
        source: "postman",
        created_by: user.id,
        updated_by: user.id,
      })
      .select("id, name")
      .single();

    if (collectionError || !newCollection) {
      return NextResponse.json({ error: collectionError?.message || "Failed to create collection" }, { status: 500 });
    }

    const allRequests = flattenPostmanRequests(Array.isArray(postman.item) ? postman.item : []);
    const inserts = allRequests.map((item) => {
      const req = item.request || {};
      const headerObj = Object.fromEntries(
        (req.header || [])
          .filter((h) => h.key)
          .map((h) => [String(h.key), String(h.value || "")])
      );

      const parsedUrl = parseUrl(req.url);

      return {
        org_id: orgId,
        collection_id: newCollection.id,
        name: String(item.name || "Imported Request"),
        method: normalizeMethod(req.method),
        url: parsedUrl || DEFAULT_IMPORT_URL,
        headers: headerObj,
        query_params: {},
        body_type: req.body?.mode || "none",
        body: req.body?.raw ? { raw: req.body.raw } : null,
        created_by: user.id,
        updated_by: user.id,
      };
    });

    let importedCount = 0;
    const importErrors: string[] = [];

    if (inserts.length > 0) {
      const { error: batchInsertError } = await supabase.from("api_requests").insert(inserts);

      if (!batchInsertError) {
        importedCount = inserts.length;
      } else {
        for (const row of inserts) {
          const { error: singleInsertError } = await supabase.from("api_requests").insert(row);
          if (singleInsertError) {
            importErrors.push(`\"${row.name}\": ${singleInsertError.message}`);
          } else {
            importedCount += 1;
          }
        }
      }
    }

    const envVariables: Record<string, string> = {};
    for (const variable of Array.isArray(postman.variable) ? postman.variable : []) {
      if (variable?.key) {
        envVariables[String(variable.key)] = String(variable.value || "");
      }
    }

    if (Object.keys(envVariables).length > 0) {
      await supabase.from("api_environments").insert({
        org_id: orgId,
        name: `${collectionName} Env`,
        variables: envVariables,
        is_shared: true,
        created_by: user.id,
        updated_by: user.id,
      });
    }

    await supabase.from("api_import_jobs").insert({
      org_id: orgId,
      collection_id: newCollection.id,
      source: "postman",
      imported_by: user.id,
      status: "success",
      imported_count: importedCount,
      raw_meta: {
        info: postman.info || {},
        total_items: allRequests.length,
        failed_count: allRequests.length - importedCount,
        failed_items: importErrors,
      },
    });

    return NextResponse.json({
      success: true,
      collection: newCollection,
      importedRequests: importedCount,
      totalRequests: allRequests.length,
      failedRequests: allRequests.length - importedCount,
      failures: importErrors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import collection" },
      { status: 500 }
    );
  }
}
