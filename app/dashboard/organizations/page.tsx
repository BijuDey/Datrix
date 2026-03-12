"use client";

import { useEffect, useState } from "react";
import { TopBar, PageHeader } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Building, Mail, CheckCircle2, XCircle, Settings, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn, formatRelativeTime } from "@/lib/utils";
import Link from "next/link";

export default function OrganizationsPage() {
  const { user, org: currentOrg, switchOrg } = useAuth();
  
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

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
      const parsed = data.map((m: any) => ({
        role: m.role,
        ...(Array.isArray(m.organizations) ? m.organizations[0] : m.organizations)
      }));
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
        setInvitations(data.invitations || []);
      }
    } catch (err) {
      console.error(err);
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
          // Accepted - reload everything
          await loadOrganizations();
          await loadInvitations();
        } else {
          // Declined - remove from list
          setInvitations(prev => prev.filter(inv => inv.id !== inviteId));
        }
      }
    } catch (err) {
      console.error(`Failed to ${action} invite:`, err);
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="min-h-screen pt-[52px]">
      <TopBar title="Organizations" description="Manage your workspaces and invitations" />
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Organizations */}
        <div>
          <PageHeader 
            title="Your Organizations" 
            description="Workspaces you are a member of"
          >
            <Button variant="outline" size="sm" icon={<Plus size={13} />} onClick={() => alert('New org creation coming soon!')}>
              New Workspace
            </Button>
          </PageHeader>
          
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] overflow-hidden">
            {loadingOrgs ? (
              <div className="p-5 text-center text-[#8a8a8a] text-[13px] animate-pulse">Loading workspaces...</div>
            ) : organizations.length === 0 ? (
              <div className="p-10 text-center">
                <Building size={24} className="text-[#333] mx-auto mb-3" />
                <p className="text-[13px] text-[#888]">No organizations found</p>
              </div>
            ) : (
              <div className="divide-y divide-[#141414]">
                {organizations.map(o => {
                   const isActive = currentOrg?.id === o.id;
                   return (
                     <div key={o.id} className="p-5 flex items-center justify-between hover:bg-[#111] transition-colors">
                       <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                           <Building size={18} />
                         </div>
                         <div>
                           <h3 className="text-[14px] font-semibold text-[#f0f0f0] flex items-center gap-2">
                             {o.name}
                             {isActive && (
                               <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/30 uppercase tracking-wide">Active</span>
                             )}
                           </h3>
                           <p className="text-[12px] text-[#888] mt-0.5">Role: {o.role}</p>
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
                             <Button size="sm" variant="ghost" icon={<Settings size={14} />}>
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
             
             <div className="rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] overflow-hidden">
               <div className="divide-y divide-[#141414]">
                  {invitations.map(invite => (
                    <div key={invite.id} className="p-5 flex items-center justify-between hover:bg-[#111] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[#8a8a8a]">
                          <Mail size={18} />
                        </div>
                        <div>
                          <h3 className="text-[14px] font-semibold text-[#f0f0f0]">
                            {invite.organizations?.name || "Unknown Workspace"}
                          </h3>
                          <p className="text-[12px] text-[#888] mt-0.5">
                            Invited by {invite.profiles?.full_name || "someone"} as <span className="text-[#ccc] capitalize">{invite.role}</span>
                            {" · "}{formatRelativeTime(invite.created_at)}
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
    </div>
  );
}
