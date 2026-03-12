import { createClient } from "@supabase/supabase-js";
import { createServerClient as _createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Service-role Supabase client — bypasses RLS.
 * Use ONLY in server-side API routes that need admin access.
 * Never expose this to the browser.
 */
export function createServerClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * User-scoped server Supabase client for Route Handlers.
 * Uses @supabase/ssr + Next.js cookies() to act as the logged-in user.
 * Respects Row Level Security (RLS).
 */
export async function createUserServerClient() {
  const cookieStore = await cookies();
  return _createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Can't set cookies inside a Server Component render — safe to ignore
          }
        },
      },
    }
  );
}
