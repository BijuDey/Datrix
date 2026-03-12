import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-16 px-8 text-center",
        className
      )}
    >
      {Icon && (
        <div className="w-14 h-14 rounded-xl bg-[#161616] border border-[#2a2a2a] flex items-center justify-center">
          <Icon size={24} className="text-[#444]" />
        </div>
      )}
      <div>
        <p className="text-[14px] font-semibold text-[#f0f0f0]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {title}
        </p>
        {description && (
          <p className="mt-1 text-[12px] text-[#8a8a8a] max-w-xs mx-auto">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
