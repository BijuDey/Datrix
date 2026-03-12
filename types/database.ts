export type DbType = "postgres" | "mysql";

export interface DatabaseConnection {
  id: string;
  name: string;
  type: DbType;
  host: string;
  port: number;
  database: string;
  username: string;
  ssl: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  orgId?: string;
  status?: "connected" | "error" | "idle";
  // password stored encrypted server-side only
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields: { name: string; dataTypeID?: number }[];
  rowCount: number;
  duration: number;
  error?: string;
}

export interface QueryHistoryItem {
  id: string;
  connectionId: string;
  sql: string;
  executedAt: string;
  duration: number;
  rowCount: number;
  error?: string;
}

export interface SchemaTable {
  name: string;
  schema: string;
  columns: SchemaColumn[];
  rowCount?: number;
  indexes?: SchemaIndex[];
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  primary?: boolean;
  unique?: boolean;
  foreign?: { table: string; column: string };
}

export interface SchemaIndex {
  name: string;
  columns: string[];
  unique: boolean;
  primary: boolean;
}

export interface SchemaInfo {
  tables: SchemaTable[];
  views: { name: string; schema: string }[];
  functions: { name: string; schema: string }[];
}
