export type LogAction =
  | "query.exec"
  | "query.fail"
  | "row.update"
  | "row.delete"
  | "row.insert"
  | "schema.change"
  | "connection.create"
  | "connection.delete"
  | "connection.test"
  | "s3.upload"
  | "s3.delete"
  | "s3.download"
  | "auth.login"
  | "auth.logout"
  | "team.invite"
  | "team.remove";

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  orgId?: string;
  connectionId?: string;
  connectionName?: string;
  action: LogAction;
  resource?: string;
  query?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  status: "success" | "error";
  errorMessage?: string;
  duration?: number;
  createdAt: string;
}

export interface LogsFilter {
  action?: LogAction;
  userId?: string;
  connectionId?: string;
  status?: "success" | "error";
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}
