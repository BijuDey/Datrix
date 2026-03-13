import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createUserServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: connection, error: dbError } = await supabase
      .from("database_connections")
      .select("id, name, type, encrypted_config")
      .eq("id", id)
      .single();

    if (dbError || !connection) {
      return NextResponse.json({ error: "Connection not found or unauthorized" }, { status: 404 });
    }

    const config = JSON.parse(decrypt(connection.encrypted_config));

    if (connection.type === "postgres") {
      const { Client } = await import("pg").catch(() => ({ Client: null }));
      if (!Client) return NextResponse.json({ error: "PostgreSQL driver not installed" }, { status: 500 });

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
      const started = Date.now();

      try {
        await client.connect();

        const ping = await client.query(`
          SELECT version() as version, current_database() as database;
        `);

        const tablesRes = await client.query(`
          SELECT COUNT(*)::int as table_count
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
        `);

        const columnsRes = await client.query(`
          SELECT COUNT(*)::int as column_count
          FROM information_schema.columns
          WHERE table_schema = 'public';
        `);

        await client.end();

        const latencyMs = Date.now() - started;
        return NextResponse.json({
          status: latencyMs > 800 ? "degraded" : "healthy",
          latencyMs,
          engine: "PostgreSQL",
          name: connection.name,
          type: connection.type,
          version: ping.rows[0]?.version || null,
          database: ping.rows[0]?.database || null,
          tableCount: tablesRes.rows[0]?.table_count ?? 0,
          columnCount: columnsRes.rows[0]?.column_count ?? 0,
        });
      } catch (err: any) {
        return NextResponse.json(
          {
            status: "down",
            latencyMs: null,
            engine: "PostgreSQL",
            name: connection.name,
            type: connection.type,
            error: err.message,
          },
          { status: 200 }
        );
      }
    }

    if (connection.type === "mysql") {
      const mysql = await import("mysql2/promise").catch(() => null);
      if (!mysql) return NextResponse.json({ error: "MySQL driver not installed" }, { status: 500 });

      const started = Date.now();

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

        const [pingRows] = await conn.execute(
          "SELECT VERSION() as version, DATABASE() as database_name"
        );

        const [tableRows] = await conn.execute(
          "SELECT COUNT(*) as table_count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()"
        );

        const [columnRows] = await conn.execute(
          "SELECT COUNT(*) as column_count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()"
        );

        await conn.end();

        const latencyMs = Date.now() - started;
        const ping = (pingRows as any[])[0] || {};
        const tables = (tableRows as any[])[0] || {};
        const cols = (columnRows as any[])[0] || {};

        return NextResponse.json({
          status: latencyMs > 800 ? "degraded" : "healthy",
          latencyMs,
          engine: "MySQL",
          name: connection.name,
          type: connection.type,
          version: ping.version || null,
          database: ping.database_name || null,
          tableCount: Number(tables.table_count ?? 0),
          columnCount: Number(cols.column_count ?? 0),
        });
      } catch (err: any) {
        return NextResponse.json(
          {
            status: "down",
            latencyMs: null,
            engine: "MySQL",
            name: connection.name,
            type: connection.type,
            error: err.message,
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({ error: "Unsupported database type" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
