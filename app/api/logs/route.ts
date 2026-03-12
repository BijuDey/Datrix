import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");
  const action = searchParams.get("action");
  const status = searchParams.get("status");

  // In production: query Supabase logs table
  const mockLogs = [
    { id: "l1", action: "query.exec", resource: "prod-postgres", status: "success", duration: 23, userEmail: "alice@company.com", ip: "192.168.1.100", createdAt: new Date().toISOString() },
  ].filter((l) => {
    if (action && l.action !== action) return false;
    if (status && l.status !== status) return false;
    return true;
  }).slice(offset, offset + limit);

  return NextResponse.json({ logs: mockLogs, total: mockLogs.length });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // In production: write log entry to Supabase
    console.log("[Activity Log]", body);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to write log" }, { status: 500 });
  }
}
