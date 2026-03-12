import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Uses @supabase/ssr which stores the session in cookies (not localStorage),
 * so the middleware can read and validate it server-side.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
