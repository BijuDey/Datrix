import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createUserServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch connection config
    const { data: connection, error: dbError } = await supabase
      .from("database_connections")
      .select("id, type, encrypted_config")
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

      try {
        await client.connect();
        
        const result = await client.query(`
          SELECT
              c.table_name,
              c.column_name,
              c.data_type,
              c.is_nullable,
              CASE 
                WHEN tc.constraint_type = 'PRIMARY KEY' THEN true 
                ELSE false 
              END as is_primary
          FROM information_schema.columns c
          LEFT JOIN information_schema.key_column_usage kcu
              ON c.table_name = kcu.table_name 
              AND c.column_name = kcu.column_name 
              AND c.table_schema = kcu.table_schema
          LEFT JOIN information_schema.table_constraints tc
              ON kcu.constraint_name = tc.constraint_name 
              AND tc.constraint_type = 'PRIMARY KEY'
          WHERE c.table_schema = 'public';
        `);

        await client.end();

        const tablesMap: Record<string, any> = {};
        for (const row of result.rows) {
          if (!tablesMap[row.table_name]) {
            tablesMap[row.table_name] = { name: row.table_name, columns: [] };
          }
          tablesMap[row.table_name].columns.push({
            name: row.column_name,
            type: row.data_type,
            nullable: row.is_nullable === 'YES',
            primary: !!row.is_primary
          });
        }
        
        return NextResponse.json({ tables: Object.values(tablesMap) });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    if (connection.type === "mysql") {
      const mysql = await import("mysql2/promise").catch(() => null);
      if (!mysql) return NextResponse.json({ error: "MySQL driver not installed" }, { status: 500 });

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
        
        const [rows] = await conn.execute(`
          SELECT 
              COLUMNS.TABLE_NAME as table_name, 
              COLUMNS.COLUMN_NAME as column_name, 
              COLUMNS.DATA_TYPE as data_type, 
              COLUMNS.IS_NULLABLE as is_nullable, 
              CASE WHEN KEY_COLUMN_USAGE.CONSTRAINT_NAME = 'PRIMARY' THEN true ELSE false END as is_primary
          FROM INFORMATION_SCHEMA.COLUMNS 
          LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
              ON COLUMNS.TABLE_NAME = KEY_COLUMN_USAGE.TABLE_NAME 
              AND COLUMNS.COLUMN_NAME = KEY_COLUMN_USAGE.COLUMN_NAME 
              AND COLUMNS.TABLE_SCHEMA = KEY_COLUMN_USAGE.TABLE_SCHEMA
          WHERE COLUMNS.TABLE_SCHEMA = DATABASE();
        `);

        await conn.end();

        const tablesMap: Record<string, any> = {};
        for (const row of rows as any[]) {
          if (!tablesMap[row.table_name]) {
            tablesMap[row.table_name] = { name: row.table_name, columns: [] };
          }
          tablesMap[row.table_name].columns.push({
            name: row.column_name,
            type: row.data_type,
            nullable: row.is_nullable === 'YES',
            primary: !!row.is_primary
          });
        }
        
        return NextResponse.json({ tables: Object.values(tablesMap) });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Unsupported database type" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
