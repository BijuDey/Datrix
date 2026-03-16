import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createUserServerClient } from "@/lib/supabase/server";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const RESERVED_SLUGS = new Set(["admin", "api", "root", "system", "www"]);

type OrgMembershipRow = {
  role: string;
  organizations:
    | { id: string; name: string; slug: string; created_at: string | null }
    | Array<{ id: string; name: string; slug: string; created_at: string | null }>
    | null;
};

export async function GET() {
  try {
    const supabase = await createUserServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("org_members")
      .select("role, organizations(id, name, slug, created_at)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const organizations = ((data || []) as OrgMembershipRow[]).map((row) => {
      const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
      return {
        id: org?.id,
        name: org?.name,
        slug: org?.slug,
        created_at: org?.created_at,
        role: row.role,
      };
    });

    return NextResponse.json({ organizations });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load organizations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUser = await createUserServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const name = String(payload.name || "").trim();
    const description = String(payload.description || "").trim();

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: "Organization name must be between 2 and 80 characters" },
        { status: 400 }
      );
    }

    const inputSlug = String(payload.slug || "").trim();
    const slug = slugify(inputSlug || name);

    if (!slug) {
      return NextResponse.json({ error: "Invalid organization slug" }, { status: 400 });
    }

    if (RESERVED_SLUGS.has(slug)) {
      return NextResponse.json({ error: "This slug is reserved" }, { status: 400 });
    }

    const serviceClient = createServerClient();

    const { data: existingSlug } = await serviceClient
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingSlug) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }

    const { data: organization, error: orgError } = await serviceClient
      .from("organizations")
      .insert({
        name,
        slug,
        description: description || null,
        created_by: user.id,
      })
      .select("id, name, slug, description")
      .single();

    if (orgError || !organization) {
      return NextResponse.json({ error: orgError?.message || "Failed to create organization" }, { status: 500 });
    }

    const { data: membership, error: memberError } = await serviceClient
      .from("org_members")
      .insert({
        org_id: organization.id,
        user_id: user.id,
        role: "admin",
        invited_by: user.id,
      })
      .select("role")
      .single();

    if (memberError) {
      await serviceClient.from("organizations").delete().eq("id", organization.id);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    return NextResponse.json({
      organization,
      membership,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create organization" },
      { status: 500 }
    );
  }
}
