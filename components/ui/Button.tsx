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

const variants = {
  primary: "bg-amber-500 text-black hover:bg-amber-400 font-semibold shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.35)]",
  secondary: "bg-[#1e1e1e] text-[#f0f0f0] hover:bg-[#252525] border border-[#2a2a2a] font-medium",
  ghost: "text-[#8a8a8a] hover:text-[#f0f0f0] hover:bg-[#161616] font-medium",
  danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 font-medium",
  outline: "border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 font-medium",
};

const sizes = {
  sm: "h-7 px-3 text-[12px] rounded-md gap-1.5",
  md: "h-9 px-4 text-[13px] rounded-md gap-2",
  lg: "h-11 px-5 text-[14px] rounded-lg gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", loading, icon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center transition-all duration-150 cursor-pointer select-none",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" size={14} /> : icon}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
