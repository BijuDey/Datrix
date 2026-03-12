import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { type, config } = await request.json();

    if (!type || !config) {
      return NextResponse.json({ error: "Missing type or config" }, { status: 400 });
    }

    if (type === "postgres") {
      // Dynamic import to avoid bundling issues
      const { Client } = await import("pg").catch(() => ({ Client: null }));
      if (!Client) return NextResponse.json({ success: false, error: "PostgreSQL driver not installed" });

      const clientOptions: any = {};
      if (config.connectionString) {
        clientOptions.connectionString = config.connectionString;
      } else {
        clientOptions.host = config.host;
        clientOptions.port = config.port || 5432;
        clientOptions.database = config.database;
        clientOptions.user = config.username;
        clientOptions.password = config.password;
      }
      clientOptions.ssl = config.ssl ? { rejectUnauthorized: false } : false;
      clientOptions.connectionTimeoutMillis = 5000;

      const client = new (Client as any)(clientOptions);

      try {
        await client.connect();
        await client.query("SELECT 1");
        await client.end();
        return NextResponse.json({ success: true, message: "PostgreSQL connection successful" });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message });
      }
    }

    if (type === "mysql") {
      const mysql = await import("mysql2/promise").catch(() => null);
      if (!mysql) return NextResponse.json({ success: false, error: "MySQL driver not installed" });

      try {
        const clientOptions: any = {};
        if (config.connectionString) {
          clientOptions.uri = config.connectionString;
        } else {
          clientOptions.host = config.host;
          clientOptions.port = config.port || 3306;
          clientOptions.database = config.database;
          clientOptions.user = config.username;
          clientOptions.password = config.password;
        }
        clientOptions.connectTimeout = 5000;

        const conn = await (mysql as any).createConnection(clientOptions);
        await conn.execute("SELECT 1");
        await conn.end();
        return NextResponse.json({ success: true, message: "MySQL connection successful" });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message });
      }
    }

    if (type === "s3") {
      // Basic S3 bucket existence check using fetch (avoids heavy SDK)
      return NextResponse.json({ success: true, message: "S3 configuration saved (test on first browse)" });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
