import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { connectionId } = await req.json();

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
    }

    // Demo schema response — in production, connects to the actual DB
    const mockSchema = {
      tables: [
        {
          name: "users",
          schema: "public",
          columns: [
            { name: "id", type: "uuid", nullable: false, primary: true },
            { name: "email", type: "text", nullable: false },
            { name: "name", type: "text", nullable: true },
            { name: "created_at", type: "timestamptz", nullable: false },
            { name: "active", type: "boolean", nullable: false, default: "true" },
          ],
        },
        {
          name: "orders",
          schema: "public",
          columns: [
            { name: "id", type: "bigint", nullable: false, primary: true },
            { name: "user_id", type: "uuid", nullable: false, foreign: { table: "users", column: "id" } },
            { name: "status", type: "text", nullable: false },
            { name: "total", type: "numeric", nullable: false },
            { name: "created_at", type: "timestamptz", nullable: false },
          ],
        },
      ],
      views: [{ name: "active_users", schema: "public" }],
      functions: [{ name: "update_updated_at", schema: "public" }],
    };

    return NextResponse.json(mockSchema);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Schema fetch failed" },
      { status: 500 }
    );
  }
}
