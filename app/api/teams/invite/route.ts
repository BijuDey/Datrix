import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const INVITABLE_ROLES = ["editor", "member"] as const;
type InvitableRole = typeof INVITABLE_ROLES[number];

export async function POST(request: NextRequest) {
  try {
    const { email, orgId, role, invitedBy } = await request.json();

    if (!email || !orgId || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Only editor and member roles can be assigned via invite
    if (!INVITABLE_ROLES.includes(role as InvitableRole)) {
      return NextResponse.json(
        { error: "Invalid role. You can only invite members as 'editor' or 'member'." },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Check if user already exists in auth
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const existingUser = users?.find((u) => u.email === email);

    if (existingUser) {
      // Check if already a member
      const { data: existing } = await supabase
        .from("org_members")
        .select("id")
        .eq("org_id", orgId)
        .eq("user_id", existingUser.id)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: "This person is already a member of your organization." },
          { status: 409 }
        );
      }

      // Add to org directly
      const { error } = await supabase.from("org_members").insert({
        org_id: orgId,
        user_id: existingUser.id,
        role,
        invited_by: invitedBy,
      });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, message: `${email} added to your organization` });
    }

    // User doesn't exist — send Supabase invite email
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { invited_to_org: orgId, invited_role: role, invited_by: invitedBy },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard`,
    });

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Invitation sent to ${email}` });
  } catch (err) {
    console.error("Invite error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
