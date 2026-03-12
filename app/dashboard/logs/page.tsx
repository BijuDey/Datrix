"use client";

import { useEffect, useState, useCallback } from "react";
import { TopBar, PageHeader } from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  ScrollText, CheckCircle2, XCircle, Clock, Filter,
  RefreshCw, ChevronLeft, ChevronRight as ChevronNext,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatRelativeTime, cn } from "@/lib/utils";

interface Log {
  id: string;
  action: string;
  resource: string | null;
  query: string | null;
  status: string;
  duration_ms: number | null;
  created_at: string;
  user_email: string | null;
  ip_address: string | null;
}

const STATUS_OPTIONS = ["all", "success", "error"];
const PAGE_SIZE = 20;

export default function LogsPage() {
  const { org } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!org) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("activity_logs")
      .select("*", { count: "exact" })
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    const { data, count, error } = await query;
    if (!error) {
      setLogs(data as Log[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [org, page, statusFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen pt-[52px]">
      <TopBar title="Activity Logs" description="Track all actions across your organization" />
      <div className="p-6 max-w-5xl mx-auto">
        <PageHeader title="Activity Logs" description={`${total.toLocaleString()} total events`}>
          <Button variant="outline" size="sm" icon={<RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />} onClick={handleRefresh}>
            Refresh
          </Button>
        </PageHeader>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-5">
          <Filter size={13} className="text-[#555]" />
          <span className="text-[12px] text-[#555]">Status:</span>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(0); }}
              className={cn(
                "px-3 py-1 rounded-md text-[12px] font-medium capitalize transition-all",
                statusFilter === s
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                  : "text-[#666] hover:text-[#f0f0f0] border border-transparent hover:border-[#252525]"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Logs table */}
        <div className="rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#141414] flex items-center gap-2">
            <ScrollText size={14} className="text-amber-400" />
            <h2 className="text-[13px] font-semibold text-[#f0f0f0]">Events</h2>
          </div>

          {loading ? (
            <div className="divide-y divide-[#141414]">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="px-5 py-3.5 animate-pulse">
                  <div className="h-3 bg-[#1a1a1a] rounded w-3/4 mb-2" />
                  <div className="h-2 bg-[#151515] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center">
              <ScrollText size={28} className="text-[#333] mx-auto mb-3" />
              <p className="text-[13px] text-[#555]">No logs found</p>
              <p className="text-[11px] text-[#444] mt-1">Activity will appear here after running queries</p>
            </div>
          ) : (
            <div className="divide-y divide-[#141414]">
              {logs.map((log) => (
                <div key={log.id} className="px-5 py-3.5 hover:bg-[#111] transition-colors group">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {log.status === "success" ? (
                        <CheckCircle2 size={14} className="text-green-400" />
                      ) : (
                        <XCircle size={14} className="text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={log.status === "success" ? "success" : "error"} dot>
                          {log.action}
                        </Badge>
                        {log.resource && (
                          <span className="text-[11px] text-[#555] font-mono bg-[#161616] px-2 py-0.5 rounded">
                            {log.resource}
                          </span>
                        )}
                        {log.duration_ms != null && (
                          <span className="ml-auto text-[11px] text-[#444] flex items-center gap-1">
                            <Clock size={10} />
                            {log.duration_ms}ms
                          </span>
                        )}
                      </div>
                      {log.query && (
                        <p className="text-[12px] text-[#8a8a8a] font-mono truncate mb-1">{log.query}</p>
                      )}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[11px] text-[#444]">{formatRelativeTime(log.created_at)}</span>
                        {log.user_email && (
                          <span className="text-[11px] text-[#444]">by {log.user_email}</span>
                        )}
                        {log.ip_address && (
                          <span className="text-[11px] text-[#333] font-mono">{log.ip_address}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#141414]">
              <span className="text-[12px] text-[#555]">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" icon={<ChevronLeft size={12} />} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                  Prev
                </Button>
                <Button variant="ghost" size="sm" icon={<ChevronNext size={12} />} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
