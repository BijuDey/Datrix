"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({ open, onClose, title, description, children, className, size = "md" }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className={cn(
          "relative w-full animate-fade-in rounded-xl shadow-xl",
          "flex flex-col max-h-[90vh]",
          sizes[size],
          className
        )}
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between p-5" style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              {title && (
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="ml-4 flex items-center justify-center w-7 h-7 rounded-md transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 p-4", className)}
      style={{ borderTop: "1px solid var(--border)" }}
    >
      {children}
    </div>
  );
}
