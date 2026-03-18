import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: boolean;
}

export function Card({ hover = false, glow = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-edge bg-surface-card p-5",
        hover && "transition-all duration-300 hover:border-edge-hover hover:bg-surface-elevated cursor-pointer hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5",
        glow && "border-brand/30 shadow-lg shadow-brand-glow",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
