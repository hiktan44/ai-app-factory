import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

const variants = {
  primary:
    "bg-gradient-to-r from-brand to-accent-blue hover:opacity-90 text-white shadow-lg shadow-brand-glow",
  secondary:
    "bg-surface-tertiary hover:bg-surface-hover text-content border border-edge hover:border-edge-hover",
  danger: "bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20",
  ghost:
    "bg-transparent hover:bg-surface-tertiary text-content-secondary",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2.5 text-sm rounded-xl",
  lg: "px-6 py-3 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-surface",
        variants[variant],
        sizes[size],
        disabled && "opacity-40 cursor-not-allowed pointer-events-none",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
