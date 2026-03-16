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
      .from("api_collections")
      .select("id, name, description, visibility, is_imported, source, created_at, updated_at")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ collections: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load collections" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const orgId = String(payload.orgId || "");
    const name = String(payload.name || "").trim();
    const description = String(payload.description || "").trim();

    if (!orgId || !name) {
      return NextResponse.json({ error: "orgId and name are required" }, { status: 400 });
    }

    const { supabase, user, role } = await getUserAndRole(orgId);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "editor"].includes(String(role))) {
      return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("api_collections")
      .insert({
        org_id: orgId,
        name,
        description: description || null,
        created_by: user.id,
        updated_by: user.id,
        visibility: "org",
      })
      .select("id, name, description, visibility, created_at, updated_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ collection: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create collection" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await request.json();
    const id = String(payload.id || "");
    const orgId = String(payload.orgId || "");
    const name = payload.name !== undefined ? String(payload.name).trim() : undefined;
    const description = payload.description !== undefined ? String(payload.description).trim() : undefined;

    if (!id || !orgId) {
      return NextResponse.json({ error: "id and orgId are required" }, { status: 400 });
    }

    if (name !== undefined && !name) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }

    const { supabase, user, role } = await getUserAndRole(orgId);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["admin", "editor"].includes(String(role))) {
      return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = { updated_by: user.id };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;

    const { data, error } = await supabase
      .from("api_collections")
      .update(updateData)
      .eq("id", id)
      .eq("org_id", orgId)
      .select("id, name, description, visibility, created_at, updated_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ collection: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update collection" },
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

    const { error: requestDeleteError } = await supabase
      .from("api_requests")
      .delete()
      .eq("org_id", orgId)
      .eq("collection_id", id);

    if (requestDeleteError) {
      return NextResponse.json({ error: requestDeleteError.message }, { status: 500 });
    }

    const { error } = await supabase
      .from("api_collections")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete collection" },
      { status: 500 }
    );
  }
}
