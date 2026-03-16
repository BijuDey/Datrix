"use client";

import { useEffect, useState } from "react";
import { TopBar, PageHeader } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import {
  Building,
  Mail,
  CheckCircle2,
  XCircle,
  Settings,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  created_at?: string;
  role: "admin" | "editor" | "member";
}

interface InvitationRow {
  id: string;
  role: "admin" | "editor" | "member";
  status: "pending" | "accepted" | "declined";
  created_at: string;
  organizations?: { id: string; name: string; slug: string };
  profiles?: { full_name?: string | null };
}

export default function OrganizationsPage() {
  const { user, org: currentOrg, switchOrg } = useAuth();

  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);

  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgDescription, setNewOrgDescription] = useState("");
  const [createOrgError, setCreateOrgError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadOrganizations();
    loadInvitations();
  }, [user]);

  async function loadOrganizations() {
    setLoadingOrgs(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("org_members")
      .select("role, organizations(id, name, slug, created_at)")
      .eq("user_id", user?.id);

    if (data) {
      // Map to flatter structure
      const parsed: OrganizationRow[] = data.map(
        (m: {
          role: "admin" | "editor" | "member";
          organizations: OrganizationRow | OrganizationRow[] | null;
        }) => ({
          role: m.role,
          ...(Array.isArray(m.organizations)
            ? m.organizations[0]
            : m.organizations || {}),
        })
      );
      setOrganizations(parsed);
    }
    setLoadingOrgs(false);
  }

  async function loadInvitations() {
    setLoadingInvites(true);
    try {
      const res = await fetch("/api/organizations/invitations");
      if (res.ok) {
        const data = await res.json();
        setInvitations((data.invitations || []) as InvitationRow[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInvites(false);
    }
  }

  async function handleInviteAction(
    inviteId: string,
    action: "accept" | "decline"
  ) {
    setProcessingId(inviteId);
    try {
      const res = await fetch("/api/organizations/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, action }),
      });
      if (res.ok) {
        if (action === "accept") {
          // Accepted - reload everything
          await loadOrganizations();
          await loadInvitations();
        } else {
          // Declined - remove from list
          setInvitations((prev) => prev.filter((inv) => inv.id !== inviteId));
        }
      }
    } catch (err) {
      console.error(`Failed to ${action} invite:`, err);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCreateOrganization() {
    setCreateOrgError(null);
    if (!newOrgName.trim()) {
      setCreateOrgError("Organization name is required");
      return;
    }

    setCreatingOrg(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newOrgName,
          slug: newOrgSlug,
          description: newOrgDescription,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        setCreateOrgError(payload.error || "Failed to create organization");
        setCreatingOrg(false);
        return;
      }

      setOrgModalOpen(false);
      setNewOrgName("");
      setNewOrgSlug("");
      setNewOrgDescription("");

      await loadOrganizations();
      if (payload.organization?.id) {
        await switchOrg(payload.organization.id);
      }
    } catch {
      setCreateOrgError("Network error while creating organization");
    } finally {
      setCreatingOrg(false);
    }
  }

  return (
    <div className="min-h-screen pt-[52px]">
      <TopBar
        title="Organizations"
        description="Manage your workspaces and invitations"
      />
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Organizations */}
        <div>
          <PageHeader
            title="Your Organizations"
            description="Workspaces you are a member of"
          >
            <Button
              variant="outline"
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => setOrgModalOpen(true)}
            >
              New Workspace
            </Button>
          </PageHeader>

          <div className="rounded-2xl border border-subtle bg-surface overflow-hidden">
            {loadingOrgs ? (
              <div className="p-5 space-y-3">
                <div className="skeleton h-3 w-40 mx-auto" />
                <div className="skeleton h-10 rounded-xl" />
              </div>
            ) : organizations.length === 0 ? (
              <div className="p-10 text-center">
                <Building size={24} className="text-faint mx-auto mb-3" />
                <p className="text-[13px] text-muted">No organizations found</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {organizations.map((o) => {
                  const isActive = currentOrg?.id === o.id;
                  return (
                    <div
                      key={o.id}
                      className="p-5 flex items-center justify-between hover:bg-surface-2 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                          <Building size={18} />
                        </div>
                        <div>
                          <h3 className="text-[14px] font-semibold text-primary flex items-center gap-2">
                            {o.name}
                            {isActive && (
                              <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/30 uppercase tracking-wide">
                                Active
                              </span>
                            )}
                          </h3>
                          <p className="text-[12px] text-muted mt-0.5">
                            Role: {o.role}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isActive ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => switchOrg(o.id)}
                          >
                            Switch to Organization
                          </Button>
                        ) : (
                          <Link href="/dashboard/settings">
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<Settings size={14} />}
                            >
                              Settings
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Invitations */}
        {invitations.length > 0 && (
          <div>
            <PageHeader
              title="Pending Invitations"
              description="Workspaces you've been invited to join"
            />

            <div className="rounded-2xl border border-subtle bg-surface overflow-hidden">
              <div className="divide-y divide-border">
                {invitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="p-5 flex items-center justify-between hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-surface-3 border border-strong flex items-center justify-center text-secondary">
                        <Mail size={18} />
                      </div>
                      <div>
                        <h3 className="text-[14px] font-semibold text-primary">
                          {invite.organizations?.name || "Unknown Workspace"}
                        </h3>
                        <p className="text-[12px] text-muted mt-0.5">
                          Invited by {invite.profiles?.full_name || "someone"}{" "}
                          as{" "}
                          <span className="text-secondary capitalize">
                            {invite.role}
                          </span>
                          {" · "}
                          {formatRelativeTime(invite.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        disabled={processingId !== null}
                        onClick={() => handleInviteAction(invite.id, "decline")}
                        icon={<XCircle size={14} />}
                      >
                        Decline
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        loading={processingId === invite.id}
                        disabled={processingId !== null}
                        onClick={() => handleInviteAction(invite.id, "accept")}
                        icon={<CheckCircle2 size={14} />}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {orgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setOrgModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-surface border border-subtle p-5 space-y-4">
            <h3
              className="text-[15px] font-semibold text-primary"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Create Organization
            </h3>

            {createOrgError && (
              <div className="text-[12px] text-red-400 border border-red-500/25 bg-red-500/10 rounded-md px-3 py-2">
                {createOrgError}
              </div>
            )}

            <Input
              label="Organization Name"
              placeholder="Acme Data Team"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
            />
            <Input
              label="Slug (optional)"
              placeholder="acme-data-team"
              value={newOrgSlug}
              onChange={(e) => setNewOrgSlug(e.target.value)}
              hint="Leave empty to auto-generate from name"
            />
            <Textarea
              label="Description (optional)"
              rows={4}
              value={newOrgDescription}
              onChange={(e) => setNewOrgDescription(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOrgModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={creatingOrg}
                onClick={handleCreateOrganization}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
