"use client";

import { useEffect, useState } from "react";
import { TopBar, PageHeader } from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Database, HardDrive, Activity, Users, ArrowRight,
  TrendingUp, Clock, CheckCircle2, XCircle, Zap, Plus,
} from "lucide-react";
import Link from "next/link";
import { formatRelativeTime, formatDuration } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend: string;
  color: string;
}

interface ActivityLog {
  id: string;
  action: string;
  resource: string | null;
  query: string | null;
  status: string;
  duration_ms: number | null;
  created_at: string;
  user_email: string | null;
}

interface Connection {
  id: string;
  name: string;
  type: string;
}

export default function DashboardPage() {
  const { org, profile, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!org) {
      setLoading(false);
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, authLoading]);

  async function loadData() {
    const supabase = createClient();
    setLoading(true);

    try {
      // Load in parallel
      const [connResult, membersResult, logsResult, todayLogsResult] = await Promise.all([
        supabase.from("database_connections").select("id, name, type").limit(20),
        supabase.from("org_members").select("id", { count: "exact" }).eq("org_id", org!.id),
        supabase
          .from("activity_logs")
          .select("*")
          .eq("org_id", org!.id)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("activity_logs")
          .select("id", { count: "exact" })
          .eq("org_id", org!.id)
          .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);

      const dbCount = connResult.data?.length ?? 0;
      const memberCount = membersResult.count ?? 0;
      const todayQueries = todayLogsResult.count ?? 0;

      setConnections((connResult.data || []) as Connection[]);
      setRecentActivity((logsResult.data || []) as ActivityLog[]);

      setStats([
        { label: "Database Connections", value: dbCount, icon: Database, trend: `${dbCount} total`, color: "text-amber-400" },
        { label: "Queries Today", value: todayQueries, icon: Zap, trend: "since midnight", color: "text-green-400" },
        { label: "Team Members", value: memberCount, icon: Users, trend: `in ${org!.name}`, color: "text-blue-400" },
        { label: "Activity Logs", value: logsResult.data?.length ?? 0, icon: Activity, trend: "recent events", color: "text-purple-400" },
      ]);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }

  const greeting = profile?.full_name ? `Welcome back, ${profile.full_name.split(" ")[0]}` : "Welcome back";

  return (
    <div className="min-h-screen pt-[52px]">
      <TopBar title="Overview" description={greeting} />

      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader title="Overview" description="Your data infrastructure at a glance">
          <Link href="/dashboard/databases?new=1">
            <Button variant="primary" size="sm" icon={<Database size={13} />}>
              Add Connection
            </Button>
          </Link>
        </PageHeader>

        {/* Stats grid */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] animate-pulse h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="p-4 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#252525] transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[11px] font-medium text-[#8a8a8a] uppercase tracking-wider">{stat.label}</p>
                  <stat.icon size={14} className={`${stat.color} opacity-60`} />
                </div>
                <p
                  className="text-[28px] font-bold text-[#f0f0f0] tracking-[-0.03em] mb-1"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {stat.value}
                </p>
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={11} className="text-[#444]" />
                  <span className="text-[11px] text-[#8a8a8a]">{stat.trend}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Activity */}
          <div className="lg:col-span-2 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#141414]">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-amber-400" />
                <h2 className="text-[13px] font-semibold text-[#f0f0f0]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Recent Activity
                </h2>
              </div>
              <Link href="/dashboard/logs">
                <Button variant="ghost" size="sm" icon={<ArrowRight size={12} />}>
                  View all
                </Button>
              </Link>
            </div>

            <div className="divide-y divide-[#141414]">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="px-5 py-3.5 animate-pulse">
                    <div className="h-3 bg-[#1a1a1a] rounded w-3/4 mb-2" />
                    <div className="h-2 bg-[#151515] rounded w-1/2" />
                  </div>
                ))
              ) : recentActivity.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Activity size={24} className="text-[#333] mx-auto mb-3" />
                  <p className="text-[13px] text-[#555]">No activity yet</p>
                  <p className="text-[11px] text-[#444] mt-1">Connect a database and run your first query</p>
                </div>
              ) : (
                recentActivity.map((item) => (
                  <div key={item.id} className="px-5 py-3.5 hover:bg-[#111] transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {item.status === "success" ? (
                          <CheckCircle2 size={14} className="text-green-400" />
                        ) : (
                          <XCircle size={14} className="text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={item.status === "success" ? "success" : "error"} dot>
                            {item.action}
                          </Badge>
                          {item.resource && (
                            <span className="text-[11px] text-[#444] font-mono">{item.resource}</span>
                          )}
                          {item.duration_ms != null && (
                            <span className="ml-auto text-[11px] text-[#444] flex items-center gap-1">
                              <Clock size={10} />
                              {item.duration_ms}ms
                            </span>
                          )}
                        </div>
                        {item.query && (
                          <p className="text-[12px] text-[#8a8a8a] font-mono truncate">{item.query}</p>
                        )}
                        <p className="text-[11px] text-[#444] mt-1">{formatRelativeTime(item.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Connections sidebar */}
          <div className="rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#141414]">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-amber-400" />
                <h2 className="text-[13px] font-semibold text-[#f0f0f0]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Connections
                </h2>
              </div>
              <Link href="/dashboard/databases">
                <Button variant="ghost" size="sm" icon={<ArrowRight size={12} />}>
                  All
                </Button>
              </Link>
            </div>

            <div className="p-3 space-y-2">
              {loading ? (
                [...Array(2)].map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-[#111] border border-[#1a1a1a] animate-pulse" />
                ))
              ) : connections.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-[12px] text-[#555]">No connections yet</p>
                </div>
              ) : (
                connections.slice(0, 5).map((conn) => (
                  <Link
                    key={conn.id}
                    href={`/dashboard/databases/${conn.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#111] border border-[#1a1a1a] hover:border-amber-500/25 hover:bg-amber-500/5 transition-all group"
                  >
                    <div className="w-2 h-2 rounded-full shrink-0 bg-green-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[#f0f0f0] truncate">{conn.name}</p>
                      <p className="text-[11px] text-[#444] truncate font-mono">{conn.type}</p>
                    </div>
                    <Badge variant={conn.type === "postgres" ? "info" : conn.type === "mysql" ? "warning" : "default"}>
                      {conn.type === "postgres" ? "PG" : conn.type === "mysql" ? "MY" : "S3"}
                    </Badge>
                  </Link>
                ))
              )}

              <Link href="/dashboard/databases?new=1">
                <button className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-[#252525] text-[12px] text-[#444] hover:text-amber-400 hover:border-amber-500/30 transition-all">
                  <Plus size={12} />
                  Add connection
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
