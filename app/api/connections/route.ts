import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      request.headers.get("authorization")?.replace("Bearer ", "") || ""
    );

    // Get org_id from query
    const orgId = request.nextUrl.searchParams.get("org_id");
    if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });

    const { data, error } = await supabase
      .from("database_connections")
      .select("id, name, type, created_at, created_by")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, name, type, config, userId } = body;

    if (!orgId || !name || !type || !config) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const encryptedConfig = encrypt(JSON.stringify(config));

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("database_connections")
      .insert({
        org_id: orgId,
        name,
        type,
        encrypted_config: encryptedConfig,
        created_by: userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    const supabase = createServerClient();
    const { error } = await supabase.from("database_connections").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
