"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import {
  Database,
  HardDrive,
  Users,
  ScrollText,
  ChevronRight,
  LayoutDashboard,
  Settings,
  LogOut,
  ShieldCheck,
  Building,
  Braces,
  Workflow,
} from "lucide-react";
import { config } from "@/config/app";
import { useAuth } from "@/lib/auth-context";
import { BrandLogo } from "@/components/ui/BrandLogo";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Databases", href: "/dashboard/databases", icon: Database },
  { label: "Storage", href: "/dashboard/storage", icon: HardDrive },
  { label: "Teams", href: "/dashboard/teams", icon: Users },
  { label: "Organizations", href: "/dashboard/organizations", icon: Building },
  { label: "API Studio", href: "/dashboard/api-studio", icon: Workflow },
  { label: "JSON Viewer", href: "/dashboard/json-viewer", icon: Braces },
  { label: "Logs", href: "/dashboard/logs", icon: ScrollText },
];

const adminNavItems = [
  { label: "Admin Panel", href: "/dashboard/admin", icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile, org, orgRole, isAdmin, signOut, loading } = useAuth();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const roleBadgeColor: Record<string, string> = {
    owner: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    admin: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    editor: "bg-green-500/15 text-green-400 border-green-500/25",
    viewer: "",
  };

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-30 flex flex-col w-[248px] shrink-0"
      style={{
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5 h-[52px] shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <BrandLogo iconSize={28} showText textClassName="text-[15px] font-bold tracking-[-0.03em]" />
        <span
          className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{
            color: "var(--text-faint)",
            background: "var(--bg-elevated)",
          }}
        >
          v0.1
        </span>
      </div>

      {/* Org chip */}
      {!loading && org && (
        <div className="px-3 pt-3 pb-1">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              background: "var(--bg-elevated)",
            }}
          >
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold uppercase"
              style={{
                background: "var(--bg-overlay)",
                color: "var(--text-muted)",
              }}
            >
              {org.name.charAt(0)}
            </div>
            <span
              className="text-[12px] font-medium truncate flex-1"
              style={{ color: "var(--text-primary)" }}
            >
              {org.name}
            </span>
            {orgRole && (
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                  roleBadgeColor[orgRole] || ""
                )}
                style={
                  !roleBadgeColor[orgRole]
                    ? {
                        background: "var(--bg-overlay)",
                        color: "var(--text-faint)",
                        borderColor: "var(--border-light)",
                      }
                    : {}
                }
              >
                {orgRole}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group",
                  active
                    ? "bg-amber-500/10 text-amber-400"
                    : "text-muted hover:text-primary hover:bg-surface-2"
                )}
              >
                <item.icon
                  size={15}
                  className={cn(
                    "shrink-0 transition-colors",
                    active ? "text-amber-400" : "text-muted group-hover:text-primary"
                  )}
                />
                {item.label}
                {active && (
                  <ChevronRight size={12} className="ml-auto text-amber-400/60" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Admin section */}
        {isAdmin && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <p
              className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-1.5"
              style={{ color: "var(--text-faint)" }}
            >
              Admin
            </p>
            {adminNavItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group",
                    active
                      ? "bg-amber-500/10 text-amber-400"
                      : "text-muted hover:text-primary hover:bg-surface-2"
                  )}
                >
                  <item.icon
                    size={15}
                    className={cn(
                      "shrink-0 transition-colors",
                      active ? "text-amber-400" : "text-muted group-hover:text-primary"
                    )}
                  />
                  {item.label}
                  {active && <ChevronRight size={12} className="ml-auto text-amber-400/60" />}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Quick add */}
      <div className="px-3 pb-3">
        <div
          className="p-3 rounded-lg space-y-2"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-light)",
          }}
        >
          <p
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Quick add
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/dashboard/databases?new=1"
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-md transition-all group"
              style={{
                background: "var(--bg-overlay)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(245,158,11,0.3)";
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(245,158,11,0.05)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--bg-subtle)";
                (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-overlay)";
              }}
            >
              <Database size={14} style={{ color: "var(--text-muted)" }} />
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Database
              </span>
            </Link>
            <Link
              href="/dashboard/storage?new=1"
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-md transition-all group"
              style={{
                background: "var(--bg-overlay)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(245,158,11,0.06)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-overlay)";
              }}
            >
              <HardDrive size={14} style={{ color: "var(--text-muted)" }} />
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Storage
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Settings + User */}
      <div
        className="px-3 pb-3 pt-3 space-y-1"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-muted hover:text-primary hover:bg-surface-2 transition-all"
        >
          <Settings size={15} />
          Settings
        </Link>

        {/* User info + sign out */}
        {!loading && profile && (
          <div
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all group cursor-pointer hover:bg-surface-2"
            onClick={signOut}
          >
            <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center text-[11px] font-bold text-amber-400 shrink-0">
              {getInitials(profile.full_name || "U")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {profile.full_name || "User"}
              </p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-faint)" }}>
                Sign out
              </p>
            </div>
            <LogOut size={13} className="text-faint group-hover:text-red-400 transition-colors shrink-0" />
          </div>
        )}
      </div>
    </aside>
  );
}
