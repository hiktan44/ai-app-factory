"use client";

import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/constants";

interface CategorySelectorProps {
  selected: string;
  onSelect: (category: string) => void;
}

export function CategorySelector({ selected, onSelect }: CategorySelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onSelect(cat.value)}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all text-center",
            selected === cat.value
              ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
              : "border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-hover)]",
          )}
        >
          <span className="text-2xl">{cat.icon}</span>
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {cat.label}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] leading-tight">
            {cat.description}
          </span>
        </button>
      ))}
    </div>
  );
}
