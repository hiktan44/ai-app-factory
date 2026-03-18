import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ hover = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5",
        hover && "transition-colors hover:border-[var(--color-border-hover)] cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
