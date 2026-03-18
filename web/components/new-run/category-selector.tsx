"use client";

import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/constants";

interface CategorySelectorProps {
  selected: string;
  onSelect: (category: string) => void;
}

export function CategorySelector({ selected, onSelect }: CategorySelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onSelect(cat.value)}
          className={cn(
            "flex flex-col items-center gap-2.5 rounded-2xl border-2 p-5 transition-all duration-300 text-center group",
            selected === cat.value
              ? "border-[var(--color-brand)] bg-[var(--color-brand-subtle)] shadow-lg shadow-[var(--color-brand-glow)] scale-[1.02]"
              : "border-[var(--color-edge)] bg-[var(--color-surface-card)] hover:border-[var(--color-edge-hover)] hover:bg-[var(--color-surface-elevated)] hover:scale-[1.01]",
          )}
        >
          <span className={cn(
            "text-3xl transition-transform duration-300",
            selected === cat.value ? "scale-110" : "group-hover:scale-105"
          )}>
            {cat.icon}
          </span>
          <span className={cn(
            "text-sm font-semibold transition-colors",
            selected === cat.value ? "text-[var(--color-brand-hover)]" : "text-[var(--color-content)]"
          )}>
            {cat.label}
          </span>
          <span className="text-[10px] text-[var(--color-content-muted)] leading-tight">
            {cat.description}
          </span>
        </button>
      ))}
    </div>
  );
}
