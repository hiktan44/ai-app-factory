"use client";

import { Card } from "@/components/ui/card";
import type { PipelineStep } from "@/lib/types";
import { formatCost } from "@/lib/utils";

interface CostTrackerProps {
  steps: PipelineStep[];
  totalCost: number;
}

export function CostTracker({ steps, totalCost }: CostTrackerProps) {
  const stepsWithCost = steps.filter((s) => s.costUsd && s.costUsd > 0);

  if (stepsWithCost.length === 0 && totalCost === 0) return null;

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
        \ud83d\udcb0 Maliyet Takibi
      </h3>
      <div className="space-y-2">
        {stepsWithCost.map((step) => (
          <div
            key={step.number}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-[var(--color-text-secondary)]">
              {step.label}
            </span>
            <span className="text-[var(--color-terminal-cost)] font-mono">
              {formatCost(step.costUsd || 0)}
            </span>
          </div>
        ))}
        <div className="border-t border-[var(--color-border)] pt-2 flex items-center justify-between text-sm font-medium">
          <span className="text-[var(--color-text-primary)]">Toplam</span>
          <span className="text-[var(--color-terminal-cost)] font-mono">
            {formatCost(totalCost)}
          </span>
        </div>
      </div>
    </Card>
  );
}
