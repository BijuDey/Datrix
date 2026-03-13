"use client";

import { useAuth } from "@/lib/auth-context";
import { useState, useEffect } from "react";
import { Users, ArrowRight, CheckCircle2, XCircle, Mail, Building, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export function RequireOrg({ children }: { children: React.ReactNode }) {
  const { org, loading, user, profile, refreshAuth } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<"create" | "invites">("create");
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (user && !org) {
      fetchInvitations();
    } else {
      setLoadingInvites(false);
    }
  }, [user, org]);

  async function fetchInvitations() {
    setLoadingInvites(true);
    try {
      const res = await fetch("/api/organizations/invitations");
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
        if (data.invitations && data.invitations.length > 0) {
          setActiveTab("invites");
        }
      }
    } catch (err) {
      console.error("Failed to fetch invitations:", err);
    } finally {
      setLoadingInvites(false);
    }
  }

  async function handleInviteAction(inviteId: string, action: "accept" | "decline") {
    setProcessingId(inviteId);
    try {
      const res = await fetch("/api/organizations/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, action }),
      });
      if (res.ok) {
        if (action === "accept") {
          // Refresh auth context so it triggers org load
          await refreshAuth();
          window.location.href = "/dashboard";
        } else {
          // If declined, remove from list
          setInvitations(prev => prev.filter(inv => inv.id !== inviteId));
          if (invitations.length === 1) setActiveTab("create");
        }
      }
    } catch (err) {
      console.error(`Failed to ${action} invite:`, err);
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-base items-center justify-center relative">
        <div className="flex flex-col items-center gap-4">
           <div className="w-12 h-12 rounded-xl skeleton" />
           <div className="w-32 h-2 rounded skeleton" />
        </div>
      </div>
    );
  }

  // Not signed in? Middleware should catch this, but just in case:
  if (!user) return null;

  if (!org) {
    return (
      <div className="flex min-h-screen bg-base items-center justify-center p-6">
        <div className="w-full max-w-md border border-subtle bg-surface rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-6 border-b border-subtle">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6 mx-auto">
              <Users size={20} className="text-amber-400" />
            </div>
            <h1 className="text-[22px] font-bold text-center tracking-[-0.03em] text-primary mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Welcome to Datrix
            </h1>
            <p className="text-[13px] text-muted text-center leading-relaxed">
              Get started by creating a workspace or joining an existing one.
            </p>
          </div>

          {/* Tabs */}
          {invitations.length > 0 && (
            <div className="flex border-b border-subtle">
              <button
                onClick={() => setActiveTab("invites")}
                className={cn(
                  "flex-1 py-3 text-[13px] font-medium flex items-center justify-center gap-2 transition-colors",
                  activeTab === "invites" ? "text-amber-400 border-b-2 border-amber-400" : "text-muted hover:text-primary"
                )}
              >
                <Mail size={14} />
                Pending Invites
                <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full">
                  {invitations.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("create")}
                className={cn(
                  "flex-1 py-3 text-[13px] font-medium flex items-center justify-center gap-2 transition-colors",
                  activeTab === "create" ? "text-amber-400 border-b-2 border-amber-400" : "text-muted hover:text-primary"
                )}
              >
                <Plus size={14} />
                Create Workspace
              </button>
            </div>
          )}

          <div className="p-8 bg-base">
            {activeTab === "invites" && invitations.length > 0 && (
              <div className="space-y-4">
                {invitations.map((invite) => (
                  <div key={invite.id} className="p-4 rounded-xl border border-subtle bg-surface space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-elevated border border-subtle flex items-center justify-center shrink-0">
                        <Building size={18} className="text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-primary truncate">
                          {invite.organizations?.name || "Unknown Workspace"}
                        </p>
                        <p className="text-[12px] text-muted mt-0.5">
                          Invited by <span className="text-secondary">{invite.profiles?.full_name || "a team member"}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-subtle">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        loading={processingId === invite.id}
                        disabled={processingId !== null}
                        onClick={() => handleInviteAction(invite.id, "accept")}
                        icon={<CheckCircle2 size={14} />}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        disabled={processingId !== null}
                        onClick={() => handleInviteAction(invite.id, "decline")}
                        icon={<XCircle size={14} />}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "create" && (
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!orgName.trim()) return;
                  setCreating(true);
                  setError(null);
                  try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                    const res = await fetch("/api/auth/signup", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        userId: user.id,
                        fullName: profile?.full_name || user.email?.split("@")[0] || "User",
                        orgName: orgName.trim()
                      }),
                      signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);

                    if (res.ok) {
                       window.location.href = "/dashboard";
                    } else {
                       const data = await res.json();
                       setError(data.error || "Failed to create workspace");
                    }
                  } catch (err: any) {
                     if (err.name === "AbortError") {
                       setError("Connection to server timed out. Next.js might be busy.");
                     } else {
                       setError("Network error occurred");
                     }
                  } finally {
                     setCreating(false);
                  }
                }}
                className="space-y-5"
              >
                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] text-center">
                    {error}
                  </div>
                )}
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  label="Workspace Name"
                  required
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  loading={creating}
                  icon={!creating ? <ArrowRight size={15} /> : undefined}
                >
                  {creating ? "Creating..." : "Create workspace"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
