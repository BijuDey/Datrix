import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/server";

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
    if (!orgId) return NextResponse.json({ error: "org_id is required" }, { status: 400 });

    const { supabase, user } = await getUserAndRole(orgId);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("api_environments")
      .select("id, name, variables, is_shared, created_at, updated_at")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ environments: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load environments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const orgId = String(payload.orgId || "");
    const name = String(payload.name || "").trim();

    if (!orgId || !name) {
      return NextResponse.json({ error: "orgId and name are required" }, { status: 400 });
    }

    const { supabase, user, role } = await getUserAndRole(orgId);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "editor"].includes(String(role))) {
      return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("api_environments")
      .insert({
        org_id: orgId,
        name,
        variables: payload.variables ?? {},
        is_shared: payload.isShared ?? true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("id, name, variables, is_shared, created_at, updated_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ environment: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create environment" },
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

    const { data, error } = await supabase
      .from("api_environments")
      .update({
        name: payload.name,
        variables: payload.variables,
        is_shared: payload.isShared,
        updated_by: user.id,
      })
      .eq("id", id)
      .eq("org_id", orgId)
      .select("id, name, variables, is_shared, created_at, updated_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ environment: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update environment" },
      { status: 500 }
    );
  }
}
