import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/server";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);
const DEFAULT_TIMEOUT_MS = 30_000;

async function getUserAndRole(orgId: string) {
  const supabase = await createUserServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, role: null };

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  return { user, role: membership?.role ?? null };
}

function normalizeHeaders(input: unknown): HeadersInit {
  if (!input || typeof input !== "object") return {};

  const source = input as Record<string, unknown>;
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    if (!key.trim()) continue;
    if (value === undefined || value === null) continue;
    normalized[key] = typeof value === "string" ? value : JSON.stringify(value);
  }

  return normalized;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const orgId = String(payload.orgId || "").trim();
    const url = String(payload.url || "").trim();
    const method = String(payload.method || "GET").toUpperCase();

    if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });
    if (!ALLOWED_METHODS.has(method)) {
      return NextResponse.json({ error: `Unsupported method: ${method}` }, { status: 400 });
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return NextResponse.json({ error: "Only http and https URLs are supported" }, { status: 400 });
    }

    const { user, role } = await getUserAndRole(orgId);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!role) return NextResponse.json({ error: "Insufficient role" }, { status: 403 });

    const timeoutMs = Number(payload.timeoutMs) > 0 ? Number(payload.timeoutMs) : DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const hasBody = !["GET", "HEAD"].includes(method);
      const response = await fetch(targetUrl.toString(), {
        method,
        headers: normalizeHeaders(payload.headers),
        body: hasBody && payload.body !== undefined && payload.body !== null
          ? typeof payload.body === "string"
            ? payload.body
            : JSON.stringify(payload.body)
          : undefined,
        signal: controller.signal,
      });

      const contentType = String(response.headers.get("content-type") || "").toLowerCase();

      let data: unknown;
      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch {
          data = await response.text();
        }
      } else {
        data = await response.text();
      }

      return NextResponse.json({
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        data,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json({ error: `Request timed out after ${timeoutMs}ms` }, { status: 504 });
      }

      const message = error instanceof Error ? error.message : "Request failed";
      return NextResponse.json({ error: message }, { status: 502 });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute request" },
      { status: 500 }
    );
  }
}
