import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "error" | "warning" | "info" | "amber" | "purple";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const variants: Record<BadgeVariant, string> = {
  default:  "bg-[#252525] text-[#8a8a8a] border-[#2a2a2a]",
  success:  "bg-green-500/10 text-green-400 border-green-500/20",
  error:    "bg-red-500/10 text-red-400 border-red-500/20",
  warning:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  info:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  amber:    "bg-amber-500/15 text-amber-300 border-amber-500/30",
  purple:   "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-[#8a8a8a]",
  success: "bg-green-400",
  error:   "bg-red-400",
  warning: "bg-amber-400",
  info:    "bg-blue-400",
  amber:   "bg-amber-300",
  purple:  "bg-purple-400",
};

export function Badge({ children, variant = "default", className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border",
        variants[variant],
        className
      )}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full", dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
