"use client";

import { useEffect, useState, useCallback } from "react";
import { TopBar, PageHeader } from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/Badge";
import {
  ShieldCheck, Database, Users, CheckSquare, Square,
  RefreshCw, AlertCircle, Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getInitials, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface Member {
  user_id: string;
  role: string;
  email: string;
  name: string;
}

interface Connection {
  id: string;
  name: string;
  type: string;
}

interface Grant {
  user_id: string;
  connection_id: string;
}

export default function AdminPage() {
  const { org, isAdmin } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) { router.replace("/dashboard"); return; }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, isAdmin]);

  const loadData = useCallback(async () => {
    if (!org) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();

    const [membersRes, connectionsRes, grantsRes] = await Promise.all([
      fetch("/api/teams/members?org_id=" + org.id).then(r => r.json()),
      supabase.from("database_connections").select("id, name, type").eq("org_id", org.id),
      supabase.from("db_access_grants").select("user_id, connection_id"),
    ]);

    const { data: memberRoles } = await supabase
      .from("org_members")
      .select("user_id, role, profiles!user_id(full_name)")
      .eq("org_id", org.id);

    const roleMap: Record<string, { role: string; name: string }> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (memberRoles || []).forEach((m: any) => {
      roleMap[m.user_id] = {
        role: m.role,
        name: Array.isArray(m.profiles) ? m.profiles[0]?.full_name : m.profiles?.full_name || "Unknown",
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membersWithInfo = (membersRes.members || []).map((m: any) => ({
      user_id: m.user_id,
      email: m.email,
      role: roleMap[m.user_id]?.role || "member",
      name: roleMap[m.user_id]?.name || m.email,
    }));

    setMembers(membersWithInfo);
    setConnections((connectionsRes.data || []) as Connection[]);
    setGrants((grantsRes.data || []) as Grant[]);
    setLoading(false);
  }, [org]);

  function hasGrant(userId: string, connId: string) {
    return grants.some((g) => g.user_id === userId && g.connection_id === connId);
  }

  async function toggleGrant(userId: string, connId: string) {
    const key = `${userId}:${connId}`;
    setToggling(key);
    const supabase = createClient();
    const exists = hasGrant(userId, connId);

    if (exists) {
      await supabase.from("db_access_grants").delete().eq("user_id", userId).eq("connection_id", connId);
      setGrants((prev) => prev.filter((g) => !(g.user_id === userId && g.connection_id === connId)));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("db_access_grants") as any).insert({ user_id: userId, connection_id: connId });
      setGrants((prev) => [...prev, { user_id: userId, connection_id: connId }]);
    }

    setSaved(key);
    setTimeout(() => setSaved(null), 1500);
    setToggling(null);
  }

  return (
    <div className="min-h-screen pt-[52px]">
      <TopBar title="Admin Panel" description="Manage organization access and permissions" />
      <div className="p-6 max-w-5xl mx-auto">
        <PageHeader title="Admin Panel" description="Control database access for each team member">
          <Badge variant="warning" dot>Admin Only</Badge>
        </PageHeader>

        {loading ? (
          <div className="rounded-xl skeleton h-64" />
        ) : (
          <>
            {connections.length === 0 || members.length === 0 ? (
              <div className="py-20 text-center rounded-xl bg-surface border border-subtle border-dashed">
                <AlertCircle size={28} className="text-muted mx-auto mb-3" />
                <p className="text-[13px] text-muted">
                  {connections.length === 0 ? "No connections yet — add a database connection first." : "No team members yet."}
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-surface border border-subtle overflow-hidden">
                <div className="px-5 py-3.5 border-b border-subtle flex items-center gap-2">
                  <ShieldCheck size={14} className="text-amber-400" />
                  <h2 className="text-[13px] font-semibold text-primary">Database Access Matrix</h2>
                  <span className="ml-auto text-[11px] text-muted">Toggle cells to grant/revoke database access per user</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-subtle">
                        <th className="px-5 py-3 text-left">
                          <div className="flex items-center gap-2 text-[11px] font-semibold text-muted uppercase tracking-wider">
                            <Users size={11} />
                            Member
                          </div>
                        </th>
                        {connections.map((conn) => (
                          <th key={conn.id} className="px-4 py-3 text-center min-w-[120px]">
                            <div className="flex flex-col items-center gap-1">
                              <Database size={12} className="text-muted" />
                              <span className="text-[11px] font-medium text-secondary truncate max-w-[100px]">{conn.name}</span>
                              <Badge variant={conn.type === "postgres" ? "info" : conn.type === "mysql" ? "warning" : "default"}>
                                {conn.type === "postgres" ? "PG" : conn.type === "mysql" ? "MY" : "S3"}
                              </Badge>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {members.map((member) => {
                        const isOrgAdmin = member.role === "admin";
                        return (
                          <tr key={member.user_id} className="hover:bg-surface-2 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-[11px] font-bold text-amber-400 shrink-0">
                                  {getInitials(member.name)}
                                </div>
                                <div>
                                  <p className="text-[13px] font-medium text-primary">{member.name}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-[11px] text-muted">{member.email}</p>
                                    <span className={cn("text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border",
                                      member.role === "admin"  ? "bg-amber-500/15 text-amber-400 border-amber-500/25" :
                                      member.role === "editor" ? "bg-blue-500/15 text-blue-400 border-blue-500/25" :
                                      "bg-surface-3 text-muted border-strong"
                                    )}>
                                      {member.role}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            {connections.map((conn) => {
                              const granted = isOrgAdmin || hasGrant(member.user_id, conn.id);
                              const key = `${member.user_id}:${conn.id}`;
                              const isToggling = toggling === key;
                              const wasSaved = saved === key;

                              return (
                                <td key={conn.id} className="px-4 py-4 text-center">
                                  {isOrgAdmin ? (
                                    <div className="flex items-center justify-center">
                                      <div className="w-6 h-6 rounded-md bg-green-500/10 border border-green-500/20 flex items-center justify-center" title="Full access (admin)">
                                        <Check size={12} className="text-green-400" />
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => toggleGrant(member.user_id, conn.id)}
                                      disabled={isToggling}
                                      className={cn(
                                        "mx-auto flex items-center justify-center w-7 h-7 rounded-lg border transition-all",
                                        granted
                                          ? "bg-green-500/10 border-green-500/20 hover:bg-red-500/10 hover:border-red-500/20"
                                          : "bg-surface-3 border-default hover:bg-amber-500/10 hover:border-amber-500/25"
                                      )}
                                    >
                                      {isToggling ? (
                                        <RefreshCw size={11} className="animate-spin text-muted" />
                                      ) : wasSaved ? (
                                        <Check size={11} className="text-green-400" />
                                      ) : granted ? (
                                        <CheckSquare size={12} className="text-green-400" />
                                      ) : (
                                        <Square size={12} className="text-muted" />
                                      )}
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
