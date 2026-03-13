"use client";

import { Bell, Search, Moon, Sun, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface TopBarProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

// Mock user for demo
const mockUser = {
  name: "Demo User",
  email: "demo@datrix.dev",
  avatarUrl: null as string | null,
};

export function TopBar({ title, description, actions }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render theme-dependent content after mount
  useEffect(() => setMounted(true), []);

  const isDark = theme === "dark";

  return (
    <header
      className={cn(
        "fixed right-0 top-0 z-20 flex items-center gap-4 px-6",
        "backdrop-blur-md border-b",
        "h-[52px]",
        "left-[248px]" // sidebar width
      )}
      style={{
        background: "color-mix(in srgb, var(--bg-base) 85%, transparent)",
        borderColor: "var(--border)",
      }}
    >
      {/* Title area */}
      <div className="flex-1 min-w-0">
        {title && (
          <h1
            className="text-[14px] font-semibold truncate"
            style={{ color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {title}
          </h1>
        )}
        {description && (
          <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
            {description}
          </p>
        )}
      </div>

      {/* Actions area */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}

      {/* Right controls */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Search shortcut */}
        <button
          className="flex items-center gap-2 h-8 px-3 rounded-md text-[12px] transition-all"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-light)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
          }}
        >
          <Search size={12} />
          <span className="hidden sm:block">Search…</span>
          <kbd
            className="hidden md:block text-[10px] px-1.5 py-0.5 rounded font-mono"
            style={{
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-light)",
              color: "var(--text-muted)",
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <button
          className="relative flex items-center justify-center w-8 h-8 rounded-md transition-all"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
        </button>

        {/* Dark / light mode toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="flex items-center justify-center w-8 h-8 rounded-md transition-all"
            style={{ color: "var(--text-muted)" }}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        )}

        {/* User menu */}
        <button
          className="flex items-center gap-2 h-8 pl-2 pr-3 rounded-md transition-all group"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            {mockUser.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mockUser.avatarUrl} alt={mockUser.name} className="w-full h-full rounded-md object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-amber-400">{getInitials(mockUser.name)}</span>
            )}
          </div>
          <span
            className="text-[12px] hidden sm:block transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            {mockUser.name.split(" ")[0]}
          </span>
          <ChevronDown size={12} style={{ color: "var(--text-faint)" }} />
        </button>
      </div>
    </header>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1
          className="text-[22px] font-bold tracking-[-0.02em]"
          style={{ color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}
