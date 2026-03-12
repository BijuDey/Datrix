"use client";

import { Bell, Search, Moon, Sun, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";
import { useState } from "react";

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
  const [darkMode, setDarkMode] = useState(true);

  return (
    <header
      className={cn(
        "fixed right-0 top-0 z-20 flex items-center gap-4 px-6",
        "bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#1a1a1a]",
        "h-[52px]",
        "left-[248px]" // sidebar width
      )}
    >
      {/* Title area */}
      <div className="flex-1 min-w-0">
        {title && (
          <h1
            className="text-[14px] font-semibold text-[#f0f0f0] truncate"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {title}
          </h1>
        )}
        {description && (
          <p className="text-[11px] text-[#8a8a8a] truncate">{description}</p>
        )}
      </div>

      {/* Actions area */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}

      {/* Right controls */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Search shortcut */}
        <button className="flex items-center gap-2 h-8 px-3 rounded-md bg-[#161616] border border-[#252525] text-[#8a8a8a] hover:text-[#f0f0f0] hover:border-[#333] transition-all text-[12px]">
          <Search size={12} />
          <span className="hidden sm:block">Search…</span>
          <kbd className="hidden md:block text-[10px] bg-[#252525] px-1.5 py-0.5 rounded border border-[#333] font-mono">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <button className="relative flex items-center justify-center w-8 h-8 rounded-md text-[#8a8a8a] hover:text-[#f0f0f0] hover:bg-[#161616] transition-all">
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="flex items-center justify-center w-8 h-8 rounded-md text-[#8a8a8a] hover:text-[#f0f0f0] hover:bg-[#161616] transition-all"
        >
          {darkMode ? <Moon size={15} /> : <Sun size={15} />}
        </button>

        {/* User menu */}
        <button className="flex items-center gap-2 h-8 pl-2 pr-3 rounded-md hover:bg-[#161616] transition-all group">
          <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            {mockUser.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mockUser.avatarUrl} alt={mockUser.name} className="w-full h-full rounded-md object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-amber-400">{getInitials(mockUser.name)}</span>
            )}
          </div>
          <span className="text-[12px] text-[#8a8a8a] group-hover:text-[#f0f0f0] transition-colors hidden sm:block">
            {mockUser.name.split(" ")[0]}
          </span>
          <ChevronDown size={12} className="text-[#444] group-hover:text-[#8a8a8a] transition-colors" />
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
          className="text-[22px] font-bold text-[#f0f0f0] tracking-[-0.02em]"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {title}
        </h1>
        {description && <p className="mt-1 text-[13px] text-[#8a8a8a]">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}
