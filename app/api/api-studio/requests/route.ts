import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/server";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);

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

export async function GET(request: NextRequest) {
  try {
    const orgId = request.nextUrl.searchParams.get("org_id");
    const collectionId = request.nextUrl.searchParams.get("collection_id");

    if (!orgId) return NextResponse.json({ error: "org_id is required" }, { status: 400 });

    const { supabase, user } = await getUserAndRole(orgId);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let query = supabase
      .from("api_requests")
      .select("id, collection_id, name, method, url, headers, query_params, body_type, body, pre_request_script, tests_script, updated_at, last_response_status")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false });

    if (collectionId) {
      query = query.eq("collection_id", collectionId);
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ requests: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load requests" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const orgId = String(payload.orgId || "");
    const collectionId = payload.collectionId ? String(payload.collectionId) : null;
    const name = String(payload.name || "New Request").trim();
    const method = String(payload.method || "GET").toUpperCase();
    const url = String(payload.url || "").trim();

    if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    if (!ALLOWED_METHODS.has(method)) {
      return NextResponse.json({ error: "Invalid HTTP method" }, { status: 400 });
    }

    const { supabase, user, role } = await getUserAndRole(orgId);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "editor"].includes(String(role))) {
      return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("api_requests")
      .insert({
        org_id: orgId,
        collection_id: collectionId,
        name,
        method,
        url,
        headers: payload.headers ?? {},
        query_params: payload.queryParams ?? {},
        body_type: payload.bodyType ?? "none",
        body: payload.body ?? null,
        pre_request_script: payload.preRequestScript ?? null,
        tests_script: payload.testsScript ?? null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("id, collection_id, name, method, url, headers, query_params, body_type, body, pre_request_script, tests_script, updated_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ request: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create request" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await request.json();
    const id = String(payload.id || "");
    const orgId = String(payload.orgId || "");

    if (!id || !orgId) {
      return NextResponse.json({ error: "id and orgId are required" }, { status: 400 });
    }

    const { supabase, user, role } = await getUserAndRole(orgId);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "editor"].includes(String(role))) {
      return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {
      updated_by: user.id,
    };
    let contentChanged = false;

    if (payload.name !== undefined) {
      updateData.name = String(payload.name);
      contentChanged = true;
    }
    if (payload.method !== undefined) {
      const method = String(payload.method).toUpperCase();
      if (!ALLOWED_METHODS.has(method)) {
        return NextResponse.json({ error: "Invalid HTTP method" }, { status: 400 });
      }
      updateData.method = method;
      contentChanged = true;
    }
    if (payload.url !== undefined) {
      updateData.url = String(payload.url);
      contentChanged = true;
    }
    if (payload.headers !== undefined) {
      updateData.headers = payload.headers;
      contentChanged = true;
    }
    if (payload.queryParams !== undefined) {
      updateData.query_params = payload.queryParams;
      contentChanged = true;
    }
    if (payload.bodyType !== undefined) {
      updateData.body_type = String(payload.bodyType);
      contentChanged = true;
    }
    if (payload.body !== undefined) {
      updateData.body = payload.body;
      contentChanged = true;
    }
    if (payload.preRequestScript !== undefined) {
      updateData.pre_request_script = payload.preRequestScript;
      contentChanged = true;
    }
    if (payload.testsScript !== undefined) {
      updateData.tests_script = payload.testsScript;
      contentChanged = true;
    }
    if (payload.lastResponseStatus !== undefined) updateData.last_response_status = payload.lastResponseStatus;
    if (payload.lastRunAt !== undefined) updateData.last_run_at = payload.lastRunAt;

    const { data: updated, error } = await supabase
      .from("api_requests")
      .update(updateData)
      .eq("id", id)
      .eq("org_id", orgId)
      .select("id, collection_id, name, method, url, headers, query_params, body_type, body, pre_request_script, tests_script, updated_at, last_response_status")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (contentChanged) {
      const { error: revisionError } = await supabase.from("api_request_revisions").insert({
        request_id: id,
        org_id: orgId,
        snapshot: {
          name: updated.name,
          method: updated.method,
          url: updated.url,
          headers: updated.headers,
          query_params: updated.query_params,
          body_type: updated.body_type,
          body: updated.body,
          pre_request_script: updated.pre_request_script,
          tests_script: updated.tests_script,
        },
        saved_by: user.id,
        source: payload.source ? String(payload.source) : "manual-save",
      });

      if (revisionError) {
        console.error("Failed to create request revision", revisionError);
      }
    }

    return NextResponse.json({ request: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update request" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = String(request.nextUrl.searchParams.get("id") || "");
    const orgId = String(request.nextUrl.searchParams.get("org_id") || "");

    if (!id || !orgId) {
      return NextResponse.json({ error: "id and org_id are required" }, { status: 400 });
    }

    const { supabase, user, role } = await getUserAndRole(orgId);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "editor"].includes(String(role))) {
      return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
    }

    const { error } = await supabase
      .from("api_requests")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete request" },
      { status: 500 }
    );
  }
}
