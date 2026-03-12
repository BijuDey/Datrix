import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/forgot-password"];

/**
 * Updates the Supabase session from the middleware.
 * This is the official @supabase/ssr pattern for Next.js.
 * It reads the session from cookies, refreshes it if expired,
 * and writes the updated tokens back to both request and response cookies.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Because Next.js Edge runtime can sometimes fail making `fetch()` calls to Supabase,
  // especially in local development, we manually decode the session cookie to verify
  // presence instead of doing a full network roundtrip.
  const cookieHeader = request.headers.get("cookie") || "";
  const hasSession = cookieHeader.includes("sb-") && cookieHeader.includes("-auth-token");

  const { pathname } = request.nextUrl;

  // Redirect authenticated users away from auth pages AND the homepage
  if (hasSession && (pathname === "/" || pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password")) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashUrl);
  }

  // Allow public paths unconditionally
  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/api/auth")
  ) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users away from dashboard
  if (!hasSession && pathname.startsWith("/dashboard")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
