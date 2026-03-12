import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET org members with emails
export async function GET(request: NextRequest) {
  try {
    const orgId = request.nextUrl.searchParams.get("org_id");
    if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });

    const supabase = createServerClient();
    const { data: members } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("org_id", orgId);

    if (!members?.length) return NextResponse.json({ members: [] });

    const userIds = members.map((m) => m.user_id);
    
    // We must use the service role key to list users from Auth
    const { createClient } = await import("@supabase/supabase-js");
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: { users } } = await adminSupabase.auth.admin.listUsers();
    const relevant = (users || [])
      .filter((u) => userIds.includes(u.id))
      .map((u) => ({ user_id: u.id, email: u.email }));

    return NextResponse.json({ members: relevant });
  } catch (err) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
