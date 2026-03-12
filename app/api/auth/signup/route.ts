import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    console.log("[Signup API] POST route hit. Parsing JSON...");
    
    // Add safety timeout to the json parsing itself in case body stream is broken
    const parsePromise = request.json();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("request.json() timed out")), 3000)
    );
    
    const body: any = await Promise.race([parsePromise, timeoutPromise]);
    console.log("[Signup API] JSON parsed:", body);
    
    const { userId, fullName, orgName } = body;

    if (!userId || !orgName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createServerClient();

    const withTimeout = async <T,>(promise: PromiseLike<T>, ms = 8000): Promise<T> => {
      return Promise.race([
        Promise.resolve(promise),
        new Promise<T>((_, reject) => 
          setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms. Check if Supabase local docker is running.`)), ms)
        )
      ]);
    };

    console.log("[Signup API] Upserting profile for user:", userId);
    // Ensure profile exists (safety net — trigger may not have fired yet)
    const profRes: any = await withTimeout(
      supabase.from("profiles").upsert({ id: userId, full_name: fullName ?? null }, { onConflict: "id" }) as PromiseLike<any>
    );

    if (profRes.error) {
      console.error("[Signup API] Profile upsert error:", profRes.error);
      return NextResponse.json({ error: "Failed to create profile", details: profRes.error }, { status: 500 });
    }

    // Create org slug from name
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48);

    const uniqueSlug = `${slug}-${Date.now().toString(36)}`;

    console.log("[Signup API] Creating org:", uniqueSlug);
    // Create organization
    const orgRes: any = await withTimeout(
      supabase.from("organizations").insert({ name: orgName, slug: uniqueSlug, created_by: userId }).select().single() as PromiseLike<any>
    );

    if (orgRes.error) {
      console.error("[Signup API] Org creation error:", orgRes.error);
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
    }

    console.log("[Signup API] Granting admin role to user in org:", orgRes.data.id);
    // Add user as admin (org creator is always admin)
    const memRes: any = await withTimeout(
      supabase.from("org_members").insert({ org_id: orgRes.data.id, user_id: userId, role: "admin" }) as PromiseLike<any>
    );

    if (memRes.error) {
      console.error("[Signup API] Membership error:", memRes.error);
      return NextResponse.json({ error: "Failed to create membership" }, { status: 500 });
    }

    console.log("[Signup API] Workspace creation complete. Returning success.");
    return NextResponse.json({ success: true, orgId: orgRes.data.id });
  } catch (err) {
    console.error("[Signup API] Route execution error or timeout:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
