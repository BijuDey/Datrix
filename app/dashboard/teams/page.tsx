"use client";

import { useEffect, useState, useCallback } from "react";
import { TopBar, PageHeader } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Users, Plus, Mail, X, Shield, Pen, Eye,
  RefreshCw, Trash2, AlertCircle, CheckCircle2, ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatRelativeTime, cn, getInitials } from "@/lib/utils";
import type { OrgRole } from "@/lib/auth-context";

interface Member {
  id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  profiles: { full_name: string | null };
  user_email?: string;
}

const ROLES: {
  value: OrgRole;
  label: string;
  icon: React.ElementType;
  desc: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    value: "admin",
    label: "Admin",
    icon: Shield,
    desc: "Full control — manage members, connections & all data",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
  },
  {
    value: "editor",
    label: "Editor",
    icon: Pen,
    desc: "Run queries and edit data in connected databases",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/25",
  },
  {
    value: "member",
    label: "Member",
    icon: Eye,
    desc: "Run queries only — read-only access, no editing",
    color: "text-zinc-400",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/25",
  },
];

const INVITABLE_ROLES = ROLES.filter((r) => r.value !== "admin");

function RoleBadge({ role }: { role: OrgRole }) {
  const r = ROLES.find((x) => x.value === role)!;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border",
        r.bg, r.color, r.border
      )}
    >
      <r.icon size={9} />
      {r.label}
    </span>
  );
}

export default function TeamsPage() {
  const { org, orgRole, isAdmin, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!org) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    setLoading(true);

    const { data } = await supabase
      .from("org_members")
      .select("id, user_id, role, created_at, profiles(full_name)")
      .eq("org_id", org.id)
      .order("created_at", { ascending: true });

    if (data) {
      const res = await fetch("/api/teams/members?org_id=" + org.id);
      const meta = await res.json();
      const emailMap: Record<string, string> = {};
      if (meta.members) {
        meta.members.forEach((m: { user_id: string; email: string }) => {
          emailMap[m.user_id] = m.email;
        });
      }
      setMembers(
        data.map((m) => ({
          ...m,
          user_email: emailMap[m.user_id] || "—",
          profiles: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles,
        })) as Member[]
      );
    }
    setLoading(false);
  }, [org]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  async function handleInvite() {
    if (!inviteEmail.trim() || !org) return;
    setInviting(true);
    setInviteResult(null);

    const res = await fetch("/api/teams/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, orgId: org.id, role: inviteRole, invitedBy: user?.id }),
    });
    const data = await res.json();

    if (res.ok) {
      setInviteResult({ ok: true, msg: data.message });
      setInviteEmail("");
      loadMembers();
    } else {
      setInviteResult({ ok: false, msg: data.error || "Failed to send invite" });
    }
    setInviting(false);
  }

  async function handleRoleChange(memberId: string, newRole: OrgRole) {
    setUpdatingId(memberId);
    const supabase = createClient();
    await supabase.from("org_members").update({ role: newRole }).eq("id", memberId);
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m));
    setUpdatingId(null);
  }

  async function handleRemove(memberId: string, memberUserId: string) {
    if (memberUserId === user?.id) return;
    if (!confirm("Remove this member from the organization?")) return;
    const supabase = createClient();
    await supabase.from("org_members").delete().eq("id", memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  function closeInvite() {
    setShowInvite(false);
    setInviteResult(null);
    setInviteEmail("");
    setInviteRole("member");
  }

  return (
    <div className="min-h-screen pt-[52px]">
      <TopBar title="Teams" description="Manage your organization members" />
      <div className="p-6 max-w-3xl mx-auto space-y-5">

        {/* Header */}
        <PageHeader
          title="Team Members"
          description={`${members.length} member${members.length !== 1 ? "s" : ""} in ${org?.name || "your organization"}`}
        >
          {isAdmin && !showInvite && (
            <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => setShowInvite(true)}>
              Invite Member
            </Button>
          )}
        </PageHeader>

        {/* ── Invite Panel ── */}
        {showInvite && (
          <div className="rounded-2xl bg-[#0f0f0f] border border-[#1e1e1e] overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#181818]">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-amber-400" />
                <h3 className="text-[13px] font-semibold text-[#f0f0f0]">Invite a team member</h3>
              </div>
              <button
                onClick={closeInvite}
                className="text-[#444] hover:text-[#f0f0f0] transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Feedback */}
              {inviteResult && (
                <div className={cn(
                  "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[12px] border",
                  inviteResult.ok
                    ? "bg-green-500/8 border-green-500/20 text-green-400"
                    : "bg-red-500/8 border-red-500/20 text-red-400"
                )}>
                  {inviteResult.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {inviteResult.msg}
                </div>
              )}

              {/* Email input */}
              <Input
                label="Email address"
                type="email"
                placeholder="colleague@company.com"
                prefix={<Mail size={13} />}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />

              {/* Role picker */}
              <div>
                <p className="text-[11px] font-medium text-[#666] mb-2.5 uppercase tracking-wider">Select role</p>
                <div className="grid grid-cols-2 gap-2">
                  {INVITABLE_ROLES.map((r) => {
                    const active = inviteRole === r.value;
                    return (
                      <button
                        key={r.value}
                        onClick={() => setInviteRole(r.value)}
                        className={cn(
                          "relative flex flex-col gap-1.5 p-3.5 rounded-xl border text-left transition-all",
                          active
                            ? cn("border-opacity-60", r.border, r.bg)
                            : "border-[#1e1e1e] bg-[#0a0a0a] hover:border-[#2a2a2a]"
                        )}
                      >
                        {active && (
                          <span className={cn("absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full", r.color.replace("text-", "bg-"))} />
                        )}
                        <div className={cn("flex items-center gap-1.5", active ? r.color : "text-[#555]")}>
                          <r.icon size={12} />
                          <span className="text-[12px] font-semibold">{r.label}</span>
                        </div>
                        <p className="text-[11px] text-[#555] leading-relaxed">{r.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <button onClick={closeInvite} className="text-[12px] text-[#444] hover:text-[#888] transition-colors">
                  Cancel
                </button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={inviting}
                  icon={<ChevronRight size={13} />}
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim()}
                >
                  Send invite
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Members list ── */}
        <div className="rounded-2xl bg-[#0f0f0f] border border-[#1a1a1a] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#141414] flex items-center gap-2">
            <Users size={13} className="text-amber-400" />
            <h2 className="text-[13px] font-semibold text-[#f0f0f0]">Members</h2>
            <span className="ml-auto text-[11px] text-[#333] tabular-nums">{members.length}</span>
          </div>

          {loading ? (
            <div className="divide-y divide-[#111]">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-9 h-9 rounded-full bg-[#1a1a1a] animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-[#1a1a1a] rounded w-32 animate-pulse" />
                    <div className="h-2 bg-[#151515] rounded w-48 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users size={24} className="text-[#2a2a2a] mb-3" />
              <p className="text-[13px] text-[#444]">No members yet</p>
              <p className="text-[11px] text-[#333] mt-1">Invite your first team member above</p>
            </div>
          ) : (
            <div className="divide-y divide-[#111]">
              {members.map((member) => {
                const name = member.profiles?.full_name || "Unknown";
                const isCurrentUser = member.user_id === user?.id;
                const memberIsAdmin = member.role === "admin";
                const canModify = isAdmin && !isCurrentUser && !memberIsAdmin;

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3.5 px-5 py-4 hover:bg-[#0a0a0a] transition-colors group"
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-amber-500/12 border border-amber-500/15 flex items-center justify-center text-[11px] font-bold text-amber-400 shrink-0">
                      {getInitials(name)}
                    </div>

                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-medium text-[#f0f0f0] truncate">{name}</p>
                        {isCurrentUser && (
                          <span className="text-[9px] text-[#333] bg-[#161616] border border-[#222] px-1.5 py-0.5 rounded-full">
                            you
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#3a3a3a] truncate mt-0.5">{member.user_email}</p>
                    </div>

                    {/* Role + actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {canModify ? (
                        <div className="relative">
                          {updatingId === member.id ? (
                            <RefreshCw size={13} className="animate-spin text-[#333]" />
                          ) : (
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value as OrgRole)}
                              className="appearance-none cursor-pointer bg-transparent focus:outline-none"
                            >
                              {INVITABLE_ROLES.map((r) => (
                                <option key={r.value} value={r.value} className="bg-[#111] text-[#f0f0f0]">
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : null}
                      <RoleBadge role={member.role} />
                      {canModify && (
                        <button
                          onClick={() => handleRemove(member.id, member.user_id)}
                          className="opacity-0 group-hover:opacity-100 text-[#2a2a2a] hover:text-red-500 transition-all ml-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Role legend ── */}
        <div>
          <p className="text-[11px] font-medium text-[#444] uppercase tracking-wider mb-2.5">Role permissions</p>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <div
                key={r.value}
                className={cn(
                  "flex flex-col gap-2 p-3.5 rounded-xl border",
                  r.bg, r.border
                )}
              >
                <div className={cn("flex items-center gap-1.5", r.color)}>
                  <r.icon size={12} />
                  <span className="text-[12px] font-semibold">{r.label}</span>
                </div>
                <p className="text-[11px] text-[#555] leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
