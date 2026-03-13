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
        <div className="w-14 h-14 rounded-xl border border-subtle bg-surface-2 flex items-center justify-center">
          <Icon size={24} className="text-faint" />
        </div>
      )}
      <div>
        <p className="text-[14px] font-semibold text-primary" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {title}
        </p>
        {description && (
          <p className="mt-1 text-[12px] text-secondary max-w-xs mx-auto">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
