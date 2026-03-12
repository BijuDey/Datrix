import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const userClient = createServerClient();
    const { data: { user } } = await userClient.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Invitations API] User email is:", user.email);

    // Use service role to bypass RLS so we can fetch 'organizations' and 'profiles' cross-relations
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: invitations, error } = await adminSupabase
      .from("organization_invitations")
      .select(`
        id,
        role,
        status,
        created_at,
        organizations (id, name, slug),
        profiles:invited_by (full_name)
      `)
      // use ilike to be case-insensitive
      .ilike("email", user.email)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    console.log("[Invitations API] Query result:", { count: invitations?.length, error });

    if (error) {
      console.error("Error fetching invitations:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ invitations });
  } catch (err) {
    console.error("Invitations GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { inviteId, action } = await request.json(); // action: "accept" | "decline"
    const userClient = createServerClient();
    const { data: { user } } = await userClient.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!inviteId || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch the invite to verify it belongs to user
    const { data: invite, error: fetchError } = await adminSupabase
      .from("organization_invitations")
      .select("*")
      .eq("id", inviteId)
      .ilike("email", user.email)
      .eq("status", "pending")
      .single();

    if (fetchError || !invite) {
      return NextResponse.json({ error: "Invitation not found or already processed" }, { status: 404 });
    }

    if (action === "accept") {
      // Must use service role to bypass "Admins can insert members" policy because user is not in org yet
      const { error: memberError } = await adminSupabase.from("org_members").insert({
        org_id: invite.org_id,
        user_id: user.id,
        role: invite.role,
        invited_by: invite.invited_by,
      });

      if (memberError) {
        if (memberError.code !== '23505') { // 23505 is unique violation
          return NextResponse.json({ error: "Failed to join organization" }, { status: 500 });
        }
      }
      
      await adminSupabase.from("organization_invitations").update({ status: 'accepted' }).eq("id", inviteId);
      
      return NextResponse.json({ success: true, message: "Invitation accepted" });
    } else {
      // action === "decline"
      await adminSupabase.from("organization_invitations").update({ status: 'declined' }).eq("id", inviteId);
      return NextResponse.json({ success: true, message: "Invitation declined" });
    }
  } catch (err) {
    console.error("Invitations POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
