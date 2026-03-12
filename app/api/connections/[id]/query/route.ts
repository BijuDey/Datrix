import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createUserServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sql } = body;

    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ error: "SQL query is required" }, { status: 400 });
    }

    const { data: connection, error: dbError } = await supabase
      .from("database_connections")
      .select("id, type, encrypted_config, org_id")
      .eq("id", id)
      .single();

    if (dbError || !connection) {
      return NextResponse.json({ error: "Connection not found or unauthorized" }, { status: 404 });
    }

    // Optional: Log execution server-side as service role, or let client handle.
    // Client handling is fine per schema RLS (Anyone can insert).

    const config = JSON.parse(decrypt(connection.encrypted_config));
    
    let resultRows = [];
    let fields = [];
    let rowCount = 0;
    let startTime = Date.now();

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

      try {
        await client.connect();
        const res = await client.query(sql);
        
        if (Array.isArray(res)) {
           const lastRes = res[res.length - 1];
           resultRows = lastRes.rows || [];
           fields = lastRes.fields ? lastRes.fields.map((f: any) => ({ name: f.name })) : [];
           rowCount = lastRes.rowCount || resultRows.length;
        } else {
           resultRows = res.rows || [];
           fields = res.fields ? res.fields.map((f: any) => ({ name: f.name })) : [];
           rowCount = typeof res.rowCount === "number" ? res.rowCount : resultRows.length;
        }

        await client.end();
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    } else if (connection.type === "mysql") {
       const mysql = await import("mysql2/promise").catch(() => null);
       if (!mysql) return NextResponse.json({ error: "MySQL driver not installed" }, { status: 500 });
       
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

       try {
         const [rows, fieldsRaw] = await conn.query(sql);
         if (Array.isArray(rows)) {
           resultRows = rows as any[];
           rowCount = rows.length;
         } else {
           rowCount = (rows as any).affectedRows || 0;
         }
         if (fieldsRaw && Array.isArray(fieldsRaw)) {
           fields = fieldsRaw.map((f: any) => ({ name: f.name }));
         }
         await conn.end();
       } catch (err: any) {
         return NextResponse.json({ error: err.message }, { status: 400 });
       }
    } else {
      return NextResponse.json({ error: "Unsupported database type for querying" }, { status: 400 });
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      fields,
      rows: resultRows,
      rowCount,
      duration
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
