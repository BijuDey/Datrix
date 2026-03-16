"use client";

import { useEffect, useState } from "react";
import { TopBar, PageHeader } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Settings, User, Building2, Lock, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

type Tab = "profile" | "organization" | "password" | "api-studio";
const SHORTCUT_STORAGE_KEY = "apiStudio.saveShortcut.v1";

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
  // API Studio shortcut form
  const [shortcutModifier, setShortcutModifier] = useState<"meta" | "ctrl" | "alt">("meta");
  const [shortcutKey, setShortcutKey] = useState("s");

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    if (org?.name) setOrgName(org.name);
  }, [profile, org]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const fallbackModifier = navigator.platform.toLowerCase().includes("mac") ? "meta" : "ctrl";
    const raw = window.localStorage.getItem(SHORTCUT_STORAGE_KEY);

    if (!raw) {
      setShortcutModifier(fallbackModifier);
      setShortcutKey("s");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { modifier?: string; key?: string };
      const modifier = parsed.modifier;
      const key = String(parsed.key || "s").toLowerCase();

      if (modifier === "meta" || modifier === "ctrl" || modifier === "alt") {
        setShortcutModifier(modifier);
      } else {
        setShortcutModifier(fallbackModifier);
      }
      setShortcutKey(key || "s");
    } catch {
      setShortcutModifier(fallbackModifier);
      setShortcutKey("s");
    }
  }, []);

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

  function saveApiStudioShortcut() {
    const key = shortcutKey.trim().toLowerCase();

    if (!key || key.length !== 1) {
      showResult(false, "Shortcut key must be a single character");
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        SHORTCUT_STORAGE_KEY,
        JSON.stringify({ modifier: shortcutModifier, key })
      );
    }

    showResult(true, "API Studio shortcut updated");
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "organization", label: "Organization", icon: Building2 },
    { id: "password", label: "Security", icon: Lock },
    { id: "api-studio", label: "API Studio", icon: Settings },
  ];

  return (
    <div className="min-h-screen pt-13">
      <TopBar title="Settings" description="Manage your profile and organization" />
      <div className="p-6 max-w-2xl mx-auto">
        <PageHeader title="Settings" description="Configure your account and workspace" />

        {/* Tab nav */}
        <div className="flex gap-1 p-1 bg-surface-2 border border-default rounded-xl mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setResult(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-[13px] font-medium transition-all",
                tab === t.id
                  ? "bg-surface text-primary border border-default shadow-sm"
                  : "text-secondary hover:text-primary"
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

        <div className="rounded-xl bg-surface border border-subtle p-6">
          {tab === "profile" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[14px] font-semibold text-primary mb-1">Profile</h2>
                <p className="text-[12px] text-muted">Update your personal information</p>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-surface-2 border border-default">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-[16px] font-bold text-amber-400">
                  {fullName ? fullName.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-primary">{profile?.full_name || "—"}</p>
                  <p className="text-[12px] text-muted">{user?.email}</p>
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
                <label className="text-[12px] font-medium text-secondary mb-1.5 block">Email address</label>
                <div className="flex items-center gap-2.5 h-10 px-3 rounded-lg bg-surface-2 border border-default text-[13px] text-muted">
                  {user?.email}
                  <span className="ml-auto text-[10px] text-muted bg-surface-3 border border-strong px-1.5 py-0.5 rounded">read-only</span>
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
                <h2 className="text-[14px] font-semibold text-primary mb-1">Organization</h2>
                <p className="text-[12px] text-muted">
                  {isAdmin ? "Update your organization settings" : "You need admin access to change these settings"}
                </p>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-[14px] font-bold text-amber-400">
                  {orgName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-primary">{org?.name}</p>
                  <p className="text-[11px] text-muted font-mono">{org?.slug}</p>
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
                <h2 className="text-[14px] font-semibold text-primary mb-1">Security</h2>
                <p className="text-[12px] text-muted">Update your password</p>
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

          {tab === "api-studio" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[14px] font-semibold text-primary mb-1">API Studio</h2>
                <p className="text-[12px] text-muted">Configure request editor behavior and save shortcut</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-secondary">Modifier</span>
                  <select
                    value={shortcutModifier}
                    onChange={(e) => setShortcutModifier(e.target.value as "meta" | "ctrl" | "alt")}
                    className="h-10 rounded-lg border border-default bg-surface-2 px-3 text-[13px] text-primary"
                  >
                    <option value="meta">Command (Mac)</option>
                    <option value="ctrl">Control</option>
                    <option value="alt">Alt</option>
                  </select>
                </label>

                <Input
                  label="Key"
                  value={shortcutKey}
                  maxLength={1}
                  onChange={(e) => setShortcutKey(e.target.value.toLowerCase())}
                  hint="Single character, for example S"
                />
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-default text-[12px] text-secondary">
                Effective shortcut: <span className="text-amber-400 font-semibold">{shortcutModifier.toUpperCase()}+{shortcutKey.toUpperCase()}</span>
              </div>

              <Button variant="primary" size="sm" onClick={saveApiStudioShortcut}>
                Save API Studio shortcut
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
