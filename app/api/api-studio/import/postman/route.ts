import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/server";

interface PostmanItem {
  name?: string;
  item?: PostmanItem[];
  event?: PostmanEvent[];
  auth?: PostmanAuth;
  request?: {
    method?: string;
    auth?: PostmanAuth;
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
      urlencoded?: Array<{
        key?: string;
        value?: string;
        disabled?: boolean;
      }>;
      formdata?: Array<{
        key?: string;
        value?: string;
        disabled?: boolean;
      }>;
      options?: {
        raw?: {
          language?: string;
        };
      };
    };
  };
}

type PostmanEvent = {
  listen?: string;
  script?: {
    exec?: string[] | string;
  };
};

type PostmanAuth = {
  type?: string;
  bearer?: Array<{ key?: string; value?: string }>;
  basic?: Array<{ key?: string; value?: string }>;
  apikey?: Array<{ key?: string; value?: string }>;
};

type ScriptBundle = {
  preRequestScript: string;
  testsScript: string;
};

type FlattenedPostmanRequest = {
  item: PostmanItem;
  path: string[];
  scripts: ScriptBundle;
  auth: PostmanAuth | undefined;
};

type PostmanUrlObject = {
  raw?: string;
  protocol?: string;
  host?: string[];
  path?: string[];
  query?: Array<{ key?: string; value?: string }>;
};

type ParsedBody = {
  bodyType: string;
  body: unknown;
};

type PostmanRequest = NonNullable<PostmanItem["request"]>;

type ParsedUrlParts = {
  baseUrl: string;
  queryParams: Record<string, string>;
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

function splitRawUrl(raw: string): ParsedUrlParts {
  const value = String(raw || "").trim();
  if (!value) return { baseUrl: "", queryParams: {} };

  const [baseUrl, queryString] = value.split("?", 2);
  const queryParams: Record<string, string> = {};

  if (queryString) {
    for (const pair of queryString.split("&")) {
      if (!pair) continue;
      const [key, val = ""] = pair.split("=", 2);
      if (!key) continue;
      queryParams[decodeURIComponent(key)] = decodeURIComponent(val);
    }
  }

  return { baseUrl, queryParams };
}

function appendScript(existing: string, next: string) {
  const left = existing.trim();
  const right = next.trim();
  if (!left) return right;
  if (!right) return left;
  return `${left}\n\n${right}`;
}

function extractScript(events: PostmanEvent[] | undefined, listen: string): string {
  const chunks: string[] = [];
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.listen !== listen) continue;
    const exec = event?.script?.exec;
    if (Array.isArray(exec)) {
      chunks.push(exec.join("\n"));
    } else if (typeof exec === "string") {
      chunks.push(exec);
    }
  }
  return chunks.join("\n\n").trim();
}

function scriptsFromEvents(events: PostmanEvent[] | undefined): ScriptBundle {
  return {
    preRequestScript: extractScript(events, "prerequest"),
    testsScript: extractScript(events, "test"),
  };
}

function mergeScripts(parent: ScriptBundle, own: ScriptBundle): ScriptBundle {
  return {
    preRequestScript: appendScript(parent.preRequestScript, own.preRequestScript),
    testsScript: appendScript(parent.testsScript, own.testsScript),
  };
}

function parseUrl(url: string | PostmanUrlObject | undefined): ParsedUrlParts {
  if (!url) return { baseUrl: "", queryParams: {} };

  if (typeof url === "string") {
    return splitRawUrl(url);
  }

  const mergedQueryParams: Record<string, string> = {};
  for (const entry of Array.isArray(url.query) ? url.query : []) {
    if (!entry?.key) continue;
    mergedQueryParams[String(entry.key)] = String(entry.value || "");
  }

  if (url.raw && String(url.raw).trim()) {
    const rawParts = splitRawUrl(url.raw);
    return {
      baseUrl: rawParts.baseUrl,
      queryParams: {
        ...rawParts.queryParams,
        ...mergedQueryParams,
      },
    };
  }

  const protocol = String(url.protocol || "https").replace(/:$/, "");
  const host = Array.isArray(url.host) ? url.host.filter(Boolean).join(".") : "";
  const path = Array.isArray(url.path) ? `/${url.path.filter(Boolean).join("/")}` : "";

  return {
    baseUrl: host ? `${protocol}://${host}${path}` : "",
    queryParams: mergedQueryParams,
  };
}

function parseHeaders(headers: Array<{ key?: string; value?: string }> | undefined) {
  return Object.fromEntries(
    (headers || [])
      .filter((h) => h.key)
      .map((h) => [String(h.key), String(h.value || "")])
  );
}

function getAuthValue(auth: PostmanAuth | undefined, type: "bearer" | "basic" | "apikey", key: string) {
  const list = auth?.[type];
  if (!Array.isArray(list)) return "";
  const match = list.find((entry) => String(entry?.key || "") === key);
  return String(match?.value || "").trim();
}

function applyAuth(
  headers: Record<string, string>,
  queryParams: Record<string, string>,
  auth: PostmanAuth | undefined
) {
  const authType = String(auth?.type || "").toLowerCase();
  if (!authType) return;

  if (authType === "bearer") {
    const token = getAuthValue(auth, "bearer", "token");
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return;
  }

  if (authType === "basic") {
    const username = getAuthValue(auth, "basic", "username");
    const password = getAuthValue(auth, "basic", "password");
    const encoded = Buffer.from(`${username}:${password}`).toString("base64");
    headers.Authorization = `Basic ${encoded}`;
    return;
  }

  if (authType === "apikey") {
    const key = getAuthValue(auth, "apikey", "key");
    const value = getAuthValue(auth, "apikey", "value");
    const addTo = getAuthValue(auth, "apikey", "in").toLowerCase();

    if (!key || !value) return;
    if (addTo === "query") {
      queryParams[key] = value;
    } else {
      headers[key] = value;
    }
  }
}

function parseBody(body: PostmanRequest["body"] | undefined): ParsedBody {
  if (!body?.mode) return { bodyType: "none", body: null };

  if (body.mode === "raw") {
    const raw = String(body.raw || "");
    if (!raw.trim()) return { bodyType: "none", body: null };

    const language = String(body.options?.raw?.language || "").toLowerCase();
    if (language === "json") {
      try {
        return { bodyType: "json", body: JSON.parse(raw) };
      } catch {
        return { bodyType: "raw", body: raw };
      }
    }

    try {
      return { bodyType: "json", body: JSON.parse(raw) };
    } catch {
      return { bodyType: "raw", body: raw };
    }
  }

  if (body.mode === "urlencoded") {
    const payload: Record<string, string> = {};
    for (const row of Array.isArray(body.urlencoded) ? body.urlencoded : []) {
      if (row?.disabled || !row?.key) continue;
      payload[String(row.key)] = String(row.value || "");
    }
    return { bodyType: "urlencoded", body: payload };
  }

  if (body.mode === "formdata") {
    const payload: Record<string, string> = {};
    for (const row of Array.isArray(body.formdata) ? body.formdata : []) {
      if (row?.disabled || !row?.key) continue;
      payload[String(row.key)] = String(row.value || "");
    }
    return { bodyType: "formdata", body: payload };
  }

  return { bodyType: body.mode, body: null };
}

function flattenPostmanRequests(
  items: PostmanItem[],
  rootScripts: ScriptBundle,
  rootAuth: PostmanAuth | undefined
): FlattenedPostmanRequest[] {
  const bucket: FlattenedPostmanRequest[] = [];
  const stack: Array<{
    item: PostmanItem;
    path: string[];
    scripts: ScriptBundle;
    auth: PostmanAuth | undefined;
  }> = [];

  for (const item of [...(items || [])].reverse()) {
    stack.push({ item, path: [], scripts: rootScripts, auth: rootAuth });
  }

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    const { item, path, scripts, auth } = current;
    const mergedScripts = mergeScripts(scripts, scriptsFromEvents(item.event));
    const effectiveAuth = item.auth || auth;

    if (item.request) {
      bucket.push({
        item,
        path,
        scripts: mergedScripts,
        auth: item.request.auth || effectiveAuth,
      });
    }

    if (Array.isArray(item.item) && item.item.length > 0) {
      const nextPath = item.name ? [...path, String(item.name)] : path;
      for (const child of [...item.item].reverse()) {
        stack.push({
          item: child,
          path: nextPath,
          scripts: mergedScripts,
          auth: effectiveAuth,
        });
      }
    }
  }

  return bucket;
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

    const rootScripts = scriptsFromEvents(postman.event as PostmanEvent[] | undefined);
    const allRequests = flattenPostmanRequests(
      Array.isArray(postman.item) ? postman.item : [],
      rootScripts,
      postman.auth as PostmanAuth | undefined
    );

    const inserts = allRequests.map(({ item, path, scripts, auth }) => {
      const req = item.request || {};
      const headers = parseHeaders(req.header);
      const urlParts = parseUrl(req.url);
      const queryParams = { ...urlParts.queryParams };
      applyAuth(headers, queryParams, auth);

      const { bodyType, body } = parseBody(req.body);
      const baseName = String(item.name || "Imported Request");
      const pathPrefix = path.join(" / ").trim();
      const importedName = pathPrefix ? `${pathPrefix} / ${baseName}` : baseName;

      return {
        org_id: orgId,
        collection_id: newCollection.id,
        name: importedName,
        method: normalizeMethod(req.method),
        url: urlParts.baseUrl || DEFAULT_IMPORT_URL,
        headers,
        query_params: queryParams,
        body_type: bodyType,
        body,
        pre_request_script: scripts.preRequestScript || null,
        tests_script: scripts.testsScript || null,
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
