"use client";

import { useEffect, useState } from "react";
import { TopBar, PageHeader } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Settings, User, Building2, Lock, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

type Tab = "profile" | "organization" | "password";

export default function SettingsPage() {
  const { user, profile, org, isAdmin, refreshAuth } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Profile form
  const [fullName, setFullName] = useState("");
  // Org form
  const [orgName, setOrgName] = useState("");
  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    if (org?.name) setOrgName(org.name);
  }, [profile, org]);

  function showResult(ok: boolean, msg: string) {
    setResult({ ok, msg });
    setTimeout(() => setResult(null), 4000);
  }

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    if (error) showResult(false, error.message);
    else { showResult(true, "Profile updated successfully"); await refreshAuth(); }
    setSaving(false);
  }

  async function saveOrg() {
    if (!org) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("organizations").update({ name: orgName }).eq("id", org.id);
    if (error) showResult(false, error.message);
    else { showResult(true, "Organization updated successfully"); await refreshAuth(); }
    setSaving(false);
  }

  async function savePassword() {
    if (newPassword !== confirmPassword) { showResult(false, "Passwords do not match"); return; }
    if (newPassword.length < 8) { showResult(false, "Password must be at least 8 characters"); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) showResult(false, error.message);
    else { showResult(true, "Password updated successfully"); setNewPassword(""); setConfirmPassword(""); }
    setSaving(false);
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "organization", label: "Organization", icon: Building2 },
    { id: "password", label: "Security", icon: Lock },
  ];

  return (
    <div className="min-h-screen pt-[52px]">
      <TopBar title="Settings" description="Manage your profile and organization" />
      <div className="p-6 max-w-2xl mx-auto">
        <PageHeader title="Settings" description="Configure your account and workspace" />

        {/* Tab nav */}
        <div className="flex gap-1 p-1 bg-[#111] border border-[#1f1f1f] rounded-xl mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setResult(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-[13px] font-medium transition-all",
                tab === t.id
                  ? "bg-[#0f0f0f] text-[#f0f0f0] border border-[#222] shadow-sm"
                  : "text-[#666] hover:text-[#f0f0f0]"
              )}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Result banner */}
        {result && (
          <div className={cn("flex items-center gap-2.5 p-3 mb-5 rounded-lg text-[12px] border", result.ok ? "bg-green-500/8 border-green-500/20 text-green-400" : "bg-red-500/8 border-red-500/20 text-red-400")}>
            {result.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {result.msg}
          </div>
        )}

        <div className="rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] p-6">
          {tab === "profile" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[14px] font-semibold text-[#f0f0f0] mb-1">Profile</h2>
                <p className="text-[12px] text-[#555]">Update your personal information</p>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-[#111] border border-[#1f1f1f]">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-[16px] font-bold text-amber-400">
                  {fullName ? fullName.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#f0f0f0]">{profile?.full_name || "—"}</p>
                  <p className="text-[12px] text-[#555]">{user?.email}</p>
                </div>
              </div>
              <Input
                label="Full name"
                prefix={<User size={13} />}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
              />
              <div>
                <label className="text-[12px] font-medium text-[#8a8a8a] mb-1.5 block">Email address</label>
                <div className="flex items-center gap-2.5 h-10 px-3 rounded-lg bg-[#141414] border border-[#1f1f1f] text-[13px] text-[#555]">
                  {user?.email}
                  <span className="ml-auto text-[10px] text-[#444] bg-[#1e1e1e] border border-[#2a2a2a] px-1.5 py-0.5 rounded">read-only</span>
                </div>
              </div>
              <Button variant="primary" size="sm" loading={saving} onClick={saveProfile} icon={saving ? <RefreshCw size={12} className="animate-spin" /> : undefined}>
                Save changes
              </Button>
            </div>
          )}

          {tab === "organization" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[14px] font-semibold text-[#f0f0f0] mb-1">Organization</h2>
                <p className="text-[12px] text-[#555]">
                  {isAdmin ? "Update your organization settings" : "You need admin access to change these settings"}
                </p>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-[14px] font-bold text-amber-400">
                  {orgName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#f0f0f0]">{org?.name}</p>
                  <p className="text-[11px] text-[#555] font-mono">{org?.slug}</p>
                </div>
              </div>
              <Input
                label="Organization name"
                prefix={<Building2 size={13} />}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!isAdmin}
              />
              {isAdmin && (
                <Button variant="primary" size="sm" loading={saving} onClick={saveOrg}>
                  Save organization
                </Button>
              )}
            </div>
          )}

          {tab === "password" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[14px] font-semibold text-[#f0f0f0] mb-1">Security</h2>
                <p className="text-[12px] text-[#555]">Update your password</p>
              </div>
              <Input
                label="New password"
                type="password"
                prefix={<Lock size={13} />}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                hint="At least 8 characters"
              />
              <Input
                label="Confirm new password"
                type="password"
                prefix={<Lock size={13} />}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <Button variant="primary" size="sm" loading={saving} onClick={savePassword}>
                Update password
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
