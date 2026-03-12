import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createUserServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, table, data: rowData, where, limit = 100, offset = 0, sortColumn, sortOrder, filters } = body;

    if (!action || !table || typeof table !== "string") {
      return NextResponse.json({ error: "Action and table name are required" }, { status: 400 });
    }

    const { data: connection, error: dbError } = await supabase
      .from("database_connections")
      .select("id, type, encrypted_config, org_id")
      .eq("id", id)
      .single();

    if (dbError || !connection) {
      return NextResponse.json({ error: "Connection not found or unauthorized" }, { status: 404 });
    }

    const config = JSON.parse(decrypt(connection.encrypted_config));
    
    let resultRows = [];
    let fields = [];
    let rowCount = 0;

    // ----- PostgreSQL implementation -----
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
        
        let qs = "";
        let values: any[] = [];
        
        // Postgres Safe Identifier Quoting
        const qTable = `"${table.replace(/"/g, '""')}"`;
        
        if (action === "read") {
           let whereStr = "";
           if (filters && Array.isArray(filters) && filters.length > 0) {
             const clauses = filters.map(f => {
               if (f.operator === 'contains') {
                 values.push(`%${f.value}%`);
                 return `"${f.column.replace(/"/g, '""')}" ILIKE $${values.length}`;
               } else {
                 values.push(f.value);
                 return `"${f.column.replace(/"/g, '""')}" = $${values.length}`;
               }
             });
             whereStr = ` WHERE ` + clauses.join(" AND ");
           }
           
           let orderStr = "";
           if (sortColumn) {
             orderStr = ` ORDER BY "${sortColumn.replace(/"/g, '""')}" ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
           }
           
           qs = `SELECT * FROM ${qTable}${whereStr}${orderStr} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
           values.push(Math.min(limit, 1000), offset);
        } 
        else if (action === "insert") {
           const keys = Object.keys(rowData);
           const cols = keys.map(k => `"${k.replace(/"/g, '""')}"`).join(", ");
           const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
           qs = `INSERT INTO ${qTable} (${cols}) VALUES (${placeholders}) RETURNING *`;
           values = keys.map(k => rowData[k]);
        }
        else if (action === "update") {
           if (!where || Object.keys(where).length === 0) throw new Error("WHERE clause required for updating");
           const keys = Object.keys(rowData);
           const setClause = keys.map((k, i) => `"${k.replace(/"/g, '""')}" = $${i + 1}`).join(", ");
           values = keys.map(k => rowData[k]);
           
           const whereKeys = Object.keys(where);
           const whereClause = whereKeys.map((k, i) => `"${k.replace(/"/g, '""')}" = $${keys.length + i + 1}`).join(" AND ");
           values = [...values, ...whereKeys.map(k => where[k])];
           
           qs = `UPDATE ${qTable} SET ${setClause} WHERE ${whereClause} RETURNING *`;
        }
        else if (action === "delete") {
           if (!where || Object.keys(where).length === 0) throw new Error("WHERE clause required for deleting");
           const whereKeys = Object.keys(where);
           const whereClause = whereKeys.map((k, i) => `"${k.replace(/"/g, '""')}" = $${i + 1}`).join(" AND ");
           values = whereKeys.map(k => where[k]);
           
           qs = `DELETE FROM ${qTable} WHERE ${whereClause} RETURNING *`;
        }
        else {
           throw new Error("Invalid action");
        }

        const res = await client.query(qs, values);
        
        resultRows = res.rows || [];
        fields = res.fields ? res.fields.map((f: any) => ({ name: f.name })) : [];
        rowCount = typeof res.rowCount === "number" ? res.rowCount : resultRows.length;

        await client.end();
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    } 
    // ----- MySQL implementation -----
    else if (connection.type === "mysql") {
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
         let qs = "";
         let values: any[] = [];
         
         const qTable = `\`${table.replace(/`/g, '``')}\``;
         
         if (action === "read") {
            let whereStr = "";
            if (filters && Array.isArray(filters) && filters.length > 0) {
               const clauses = filters.map(f => {
                  if (f.operator === 'contains') {
                     values.push(`%${f.value}%`);
                     return `\`${f.column.replace(/`/g, '``')}\` LIKE ?`;
                  } else {
                     values.push(f.value);
                     return `\`${f.column.replace(/`/g, '``')}\` = ?`;
                  }
               });
               whereStr = ` WHERE ` + clauses.join(" AND ");
            }

            let orderStr = "";
            if (sortColumn) {
               orderStr = ` ORDER BY \`${sortColumn.replace(/`/g, '``')}\` ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
            }

            qs = `SELECT * FROM ${qTable}${whereStr}${orderStr} LIMIT ? OFFSET ?`;
            values.push(Math.min(limit, 1000), offset);
         }
         else if (action === "insert") {
            const keys = Object.keys(rowData);
            const cols = keys.map(k => `\`${k.replace(/`/g, '``')}\``).join(", ");
            const placeholders = keys.map(() => `?`).join(", ");
            qs = `INSERT INTO ${qTable} (${cols}) VALUES (${placeholders})`;
            values = keys.map(k => rowData[k]);
         }
         else if (action === "update") {
            if (!where || Object.keys(where).length === 0) throw new Error("WHERE clause required for updating");
            const keys = Object.keys(rowData);
            const setClause = keys.map(k => `\`${k.replace(/`/g, '``')}\` = ?`).join(", ");
            values = keys.map(k => rowData[k]);
            
            const whereKeys = Object.keys(where);
            const whereClause = whereKeys.map((k) => `\`${k.replace(/`/g, '``')}\` = ?`).join(" AND ");
            values = [...values, ...whereKeys.map(k => where[k])];
            
            qs = `UPDATE ${qTable} SET ${setClause} WHERE ${whereClause}`;
         }
         else if (action === "delete") {
            if (!where || Object.keys(where).length === 0) throw new Error("WHERE clause required for deleting");
            const whereKeys = Object.keys(where);
            const whereClause = whereKeys.map((k) => `\`${k.replace(/`/g, '``')}\` = ?`).join(" AND ");
            values = whereKeys.map(k => where[k]);
            
            qs = `DELETE FROM ${qTable} WHERE ${whereClause}`;
         }
         else {
            throw new Error("Invalid action");
         }

         const [rows, fieldsRaw] = await conn.execute(qs, values);
         
         if (Array.isArray(rows)) {
           resultRows = rows as any[];
           rowCount = rows.length;
         } else {
           rowCount = (rows as any).affectedRows || 0;
           // For insert/update/delete in MySQL we might just re-read or let frontend handle it
         }
         if (fieldsRaw && Array.isArray(fieldsRaw)) {
           fields = fieldsRaw.map((f: any) => ({ name: f.name }));
         }
         await conn.end();
       } catch (err: any) {
         return NextResponse.json({ error: err.message }, { status: 400 });
       }
    } 
    else {
      return NextResponse.json({ error: "Unsupported database type for exploring" }, { status: 400 });
    }

    return NextResponse.json({
      action,
      table,
      fields,
      rows: resultRows,
      rowCount
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
