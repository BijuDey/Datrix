"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TopBar, PageHeader } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import {
  Database, Plus, Trash2, X, CheckCircle2, XCircle, Play,
  Lock, Settings2, RefreshCw, ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { encrypt } from "@/lib/crypto";
import { formatRelativeTime, cn } from "@/lib/utils";
import Link from "next/link";

const SQL_DB_TYPES = [
  { value: "postgres", label: "PostgreSQL", color: "text-blue-400" },
  { value: "mysql", label: "MySQL", color: "text-orange-400" },
];

const ALL_CONNECTION_TYPES = [
  ...SQL_DB_TYPES,
  { value: "s3", label: "S3 / Object Storage", color: "text-yellow-400" },
];

interface Connection {
  id: string;
  name: string;
  type: string;
  created_at: string;
  created_by: string;
}

interface FormState {
  name: string;
  type: string;
  connectionMode: "form" | "url";
  connectionString: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  // S3 specific
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
}

const defaultForm: FormState = {
  name: "", type: "postgres", connectionMode: "form", connectionString: "", host: "", port: "5432",
  database: "", username: "", password: "", ssl: true,
  bucket: "", region: "us-east-1", accessKeyId: "", secretAccessKey: "", endpoint: "",
};

export default function DatabasesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-base p-10 text-center text-secondary">Loading...</div>}>
      <DatabasesPageContent />
    </Suspense>
  );
}

function DatabasesPageContent() {
  const { org, isAdmin, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<null | "testing" | "ok" | "fail">(null);
  const [testMsg, setTestMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [initialType, setInitialType] = useState<"postgres" | "mysql" | "s3">("postgres");

  useEffect(() => {
    if (org) {
      loadConnections();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      const requestedType = searchParams.get("type");
      if (requestedType === "s3") {
        setInitialType("s3");
        setForm((prev) => ({ ...prev, type: "s3", port: "" }));
      }
      setShowModal(true);
      router.replace("/dashboard/databases");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadConnections() {
    const supabase = createClient();
    setLoading(true);
    const { data, error } = await supabase
      .from("database_connections")
      .select("id, name, type, created_at, created_by")
      .in("type", ["postgres", "mysql"])
      .order("created_at", { ascending: false });
    if (!error) setConnections(data as Connection[]);
    setLoading(false);
  }

  async function handleTest() {
    setTestStatus("testing");
    setTestMsg("");
    try {
      const res = await fetch("/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: form.type, config: buildConfig() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus("ok");
        setTestMsg(data.message || "Connection successful");
      } else {
        setTestStatus("fail");
        setTestMsg(data.error || "Connection failed");
      }
    } catch {
      setTestStatus("fail");
      setTestMsg("Network error");
    }
  }

  function buildConfig() {
    if (form.type === "s3") {
      return { bucket: form.bucket, region: form.region, accessKeyId: form.accessKeyId, secretAccessKey: form.secretAccessKey, endpoint: form.endpoint };
    }
    if (form.connectionMode === "url") {
      return { connectionString: form.connectionString, ssl: form.ssl };
    }
    return { host: form.host, port: parseInt(form.port), database: form.database, username: form.username, password: form.password, ssl: form.ssl };
  }

  async function handleSave() {
    setError(null);
    if (!form.name.trim()) { setError("Connection name is required"); return; }
    if (!org) { setError("Organization not loaded. Please refresh."); return; }
    if (!user) { setError("User not found."); return; }
    setSaving(true);

    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          name: form.name,
          type: form.type,
          config: buildConfig(),
          userId: user.id
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to save connection");
        setSaving(false);
        return;
      }
    } catch (err: any) {
      setError(err.message || "Network error");
      setSaving(false);
      return;
    }

    setShowModal(false);
    setForm(defaultForm);
    setTestStatus(null);
    await loadConnections();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this connection? This cannot be undone.")) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from("database_connections").delete().eq("id", id);
    setConnections((prev) => prev.filter((c) => c.id !== id));
    setDeletingId(null);
  }

  const isS3 = form.type === "s3";

  return (
    <div className="min-h-screen pt-[52px]">
      <TopBar title="Databases" description="Manage database connections" />
      <div className="p-6 max-w-5xl mx-auto">
        <PageHeader title="Database Connections" description="Connect and manage your SQL databases and object storage">
          <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => setShowModal(true)}>
            Add Connection
          </Button>
        </PageHeader>

        {/* Connection list */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        ) : connections.length === 0 ? (
          <div className="py-20 text-center rounded-xl bg-surface border border-subtle border-dashed">
            <Database size={36} className="text-faint mx-auto mb-4" />
            <p className="text-[15px] font-semibold text-muted" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>No connections yet</p>
            <p className="text-[13px] text-muted mt-1 mb-6">Add a PostgreSQL or MySQL connection to get started</p>
            <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => setShowModal(true)}>
              Add Connection
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-subtle hover:border-default transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center shrink-0">
                  <Database size={16} className={ALL_CONNECTION_TYPES.find(t => t.value === conn.type)?.color || "text-secondary"} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[14px] font-semibold text-primary">{conn.name}</h3>
                    <Badge variant={conn.type === "postgres" ? "info" : conn.type === "mysql" ? "warning" : "default"}>
                      {ALL_CONNECTION_TYPES.find(t => t.value === conn.type)?.label || conn.type}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted">Added {formatRelativeTime(conn.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/databases/${conn.id}`}>
                    <Button variant="outline" size="sm" icon={<ChevronRight size={12} />}>
                      Open
                    </Button>
                  </Link>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={deletingId === conn.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      onClick={() => handleDelete(conn.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Connection Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-surface border border-default rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
              <h2 className="text-[15px] font-semibold text-primary" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Add Connection
              </h2>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-primary transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/8 border border-red-500/20 text-red-400 text-[12px]">
                  <XCircle size={13} /> {error}
                </div>
              )}

              <Input
                label="Connection name"
                placeholder="prod-postgres"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />

              {/* Type selector */}
              <div>
                <label className="text-[12px] font-medium text-secondary mb-1.5 block">Database type</label>
                <div className={cn("grid gap-2", initialType === "s3" ? "grid-cols-1" : "grid-cols-2")}>
                  {(initialType === "s3" ? ALL_CONNECTION_TYPES.filter((t) => t.value === "s3") : SQL_DB_TYPES).map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, type: t.value, port: t.value === "mysql" ? "3306" : t.value === "postgres" ? "5432" : "" });
                        setTestStatus(null);
                      }}
                      className={cn(
                        "py-2.5 px-3 rounded-lg border text-[12px] font-medium transition-all",
                        form.type === t.value
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          : "bg-surface-2 border-default text-secondary hover:border-strong hover:text-primary"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {isS3 ? (
                <>
                  <Input label="Bucket name" placeholder="my-bucket" value={form.bucket} onChange={(e) => setForm({ ...form, bucket: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Region" placeholder="us-east-1" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
                    <Input label="Endpoint (optional)" placeholder="https://..." value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} />
                  </div>
                  <Input label="Access Key ID" placeholder="AKIA..." prefix={<Lock size={12} />} value={form.accessKeyId} onChange={(e) => setForm({ ...form, accessKeyId: e.target.value })} />
                  <Input label="Secret Access Key" type="password" prefix={<Lock size={12} />} value={form.secretAccessKey} onChange={(e) => setForm({ ...form, secretAccessKey: e.target.value })} />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1 mb-2 p-1 bg-surface-3 rounded-lg w-fit border border-default">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, connectionMode: "form" })}
                      className={cn(
                        "px-3 py-1.5 text-[12px] font-medium rounded-md transition-all",
                        form.connectionMode === "form"
                          ? "bg-surface-3 text-primary shadow-sm"
                          : "text-secondary hover:text-primary"
                      )}
                    >
                      Parameters
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, connectionMode: "url" })}
                      className={cn(
                        "px-3 py-1.5 text-[12px] font-medium rounded-md transition-all",
                        form.connectionMode === "url"
                          ? "bg-surface-3 text-primary shadow-sm"
                          : "text-secondary hover:text-primary"
                      )}
                    >
                      URL Connect
                    </button>
                  </div>

                  {form.connectionMode === "url" ? (
                    <Input 
                      label="Connection URL" 
                      placeholder={form.type === "postgres" ? "postgresql://user:pass@host:5432/db" : "mysql://user:pass@host:3306/db"} 
                      type="password"
                      value={form.connectionString} 
                      onChange={(e) => setForm({ ...form, connectionString: e.target.value })} 
                    />
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <Input label="Host" placeholder="localhost" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
                        </div>
                        <Input label="Port" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input label="Database" placeholder="mydb" value={form.database} onChange={(e) => setForm({ ...form, database: e.target.value })} />
                        <Input label="Username" placeholder="postgres" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                      </div>
                      <Input label="Password" type="password" prefix={<Lock size={12} />} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </>
                  )}
                </>
              )}

              {/* Test result */}
              {testStatus && testStatus !== "testing" && (
                <div className={cn(
                  "flex items-center gap-2 p-3 rounded-lg text-[12px] border",
                  testStatus === "ok" ? "bg-green-500/8 border-green-500/20 text-green-400" : "bg-red-500/8 border-red-500/20 text-red-400"
                )}>
                  {testStatus === "ok" ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {testMsg}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-subtle">
              <Button
                variant="outline"
                size="sm"
                icon={testStatus === "testing" ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                onClick={handleTest}
                loading={testStatus === "testing"}
              >
                Test connection
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => { setShowModal(false); setForm(defaultForm); setTestStatus(null); }}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
                Save connection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
