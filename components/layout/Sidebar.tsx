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
  Zap,
  LayoutDashboard,
  Settings,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { config } from "@/config/app";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Databases", href: "/dashboard/databases", icon: Database },
  { label: "Storage", href: "/dashboard/storage", icon: HardDrive },
  { label: "Teams", href: "/dashboard/teams", icon: Users },
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
    viewer: "bg-[#1e1e1e] text-[#666] border-[#2a2a2a]",
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-30 flex flex-col",
        "bg-[#0a0a0a] border-r border-[#1a1a1a]",
        "w-[248px] shrink-0"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-[52px] border-b border-[#1a1a1a] shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/25">
          <Zap size={14} className="text-amber-400" />
        </div>
        <span
          className="text-[15px] font-bold tracking-[-0.03em] text-[#f0f0f0]"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {config.APP_NAME}
        </span>
        <span className="ml-auto text-[10px] font-medium text-[#444] bg-[#161616] border border-[#222] px-1.5 py-0.5 rounded">
          v0.1
        </span>
      </div>

      {/* Org chip */}
      {!loading && org && (
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111] border border-[#1f1f1f]">
            <div className="w-5 h-5 rounded-md bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center text-[9px] font-bold text-[#8a8a8a] uppercase">
              {org.name.charAt(0)}
            </div>
            <span className="text-[12px] text-[#f0f0f0] font-medium truncate flex-1">{org.name}</span>
            {orgRole && (
              <span className={cn("text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border", roleBadgeColor[orgRole] || roleBadgeColor.viewer)}>
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
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/15"
                    : "text-[#8a8a8a] hover:text-[#f0f0f0] hover:bg-[#161616]"
                )}
              >
                <item.icon
                  size={15}
                  className={cn(
                    "shrink-0 transition-colors",
                    active ? "text-amber-400" : "text-[#8a8a8a] group-hover:text-[#f0f0f0]"
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
          <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
            <p className="text-[10px] font-semibold text-[#444] uppercase tracking-widest px-3 mb-1.5">Admin</p>
            {adminNavItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group",
                    active
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/15"
                      : "text-[#8a8a8a] hover:text-[#f0f0f0] hover:bg-[#161616]"
                  )}
                >
                  <item.icon size={15} className={cn("shrink-0", active ? "text-amber-400" : "text-[#8a8a8a] group-hover:text-[#f0f0f0]")} />
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
        <div className="p-3 rounded-lg bg-[#111] border border-[#1f1f1f] space-y-2">
          <p className="text-[11px] text-[#8a8a8a] font-medium uppercase tracking-wider">Quick add</p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/dashboard/databases?new=1"
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-md bg-[#161616] border border-[#252525] hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group"
            >
              <Database size={14} className="text-[#8a8a8a] group-hover:text-amber-400 transition-colors" />
              <span className="text-[11px] text-[#8a8a8a] group-hover:text-[#f0f0f0] transition-colors">Database</span>
            </Link>
            <Link
              href="/dashboard/storage?new=1"
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-md bg-[#161616] border border-[#252525] hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group"
            >
              <HardDrive size={14} className="text-[#8a8a8a] group-hover:text-amber-400 transition-colors" />
              <span className="text-[11px] text-[#8a8a8a] group-hover:text-[#f0f0f0] transition-colors">Storage</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Settings + User */}
      <div className="px-3 pb-3 border-t border-[#1a1a1a] pt-3 space-y-1">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[#8a8a8a] hover:text-[#f0f0f0] hover:bg-[#161616] transition-all"
        >
          <Settings size={15} />
          Settings
        </Link>

        {/* User info + sign out */}
        {!loading && profile && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#161616] transition-all group cursor-pointer" onClick={signOut}>
            <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-[11px] font-bold text-amber-400 shrink-0">
              {getInitials(profile.full_name || "U")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[#f0f0f0] truncate">{profile.full_name || "User"}</p>
              <p className="text-[10px] text-[#444] truncate">Sign out</p>
            </div>
            <LogOut size={13} className="text-[#444] group-hover:text-red-400 transition-colors shrink-0" />
          </div>
        )}
      </div>
    </aside>
  );
}
