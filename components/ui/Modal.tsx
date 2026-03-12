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
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className={cn(
          "relative w-full animate-fade-in",
          "bg-[#111111] border border-[#1f1f1f] rounded-xl shadow-2xl",
          "flex flex-col max-h-[90vh]",
          sizes[size],
          className
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between p-5 border-b border-[#1f1f1f]">
            <div>
              {title && (
                <h2 className="text-base font-semibold text-[#f0f0f0]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 text-xs text-[#8a8a8a]">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="ml-4 flex items-center justify-center w-7 h-7 rounded-md text-[#8a8a8a] hover:text-[#f0f0f0] hover:bg-[#1e1e1e] transition-colors"
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
    <div className={cn("flex items-center justify-end gap-2 p-4 border-t border-[#1f1f1f]", className)}>
      {children}
    </div>
  );
}
