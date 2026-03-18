import { cn } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/constants";

interface BadgeProps {
  status: string;
  label: string;
  showDot?: boolean;
  className?: string;
}

export function Badge({ status, label, showDot = true, className }: BadgeProps) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.stopped;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        colors.bg,
        colors.text,
        className,
      )}
    >
      {showDot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            colors.dot,
            status === "running" && "animate-pulse-dot",
          )}
        />
      )}
      {label}
    </span>
  );
}
