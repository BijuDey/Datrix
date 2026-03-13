"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

// Inline-style variants for theme-aware colors (secondary & ghost use CSS vars)
const variants = {
  primary: "bg-amber-500 text-black hover:bg-amber-400 font-semibold shadow-sm",
  secondary: "__secondary__",
  ghost: "__ghost__",
  danger: "bg-red-500/8 text-red-400 hover:bg-red-500/14 border border-red-500/18 font-medium",
  outline: "border border-amber-500/25 text-amber-400 hover:bg-amber-500/8 font-medium",
};

const sizes = {
  sm: "h-7 px-3 text-[12px] rounded-md gap-1.5",
  md: "h-9 px-4 text-[13px] rounded-md gap-2",
  lg: "h-11 px-5 text-[14px] rounded-lg gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", loading, icon, children, disabled, style, ...props }, ref) => {
    let variantClass = variants[variant];
    let variantStyle: React.CSSProperties = {};

    if (variant === "secondary") {
      variantClass = "border font-medium";
      variantStyle = {
        background: "var(--bg-overlay)",
        color: "var(--text-primary)",
        borderColor: "var(--border-light)",
      };
    } else if (variant === "ghost") {
      variantClass = "font-medium";
      variantStyle = {
        color: "var(--text-muted)",
      };
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center transition-all duration-150 cursor-pointer select-none",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          variant !== "secondary" && variant !== "ghost" && variants[variant],
          variantClass,
          sizes[size],
          className
        )}
        style={{ ...variantStyle, ...style }}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" size={14} /> : icon}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
