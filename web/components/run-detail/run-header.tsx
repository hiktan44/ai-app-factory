"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PipelineRun } from "@/lib/types";
import { formatCost, formatDate, getCategoryLabel, getStatusLabel } from "@/lib/utils";
import { TOTAL_STEPS } from "@/lib/constants";

interface RunHeaderProps {
  run: PipelineRun;
  onStop?: () => void;
}

export function RunHeader({ run, onStop }: RunHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            {run.appName || run.id}
          </h1>
          <Badge status={run.status} label={getStatusLabel(run.status)} />
        </div>
        <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
          <span>{getCategoryLabel(run.category)}</span>
          <span>\u00b7</span>
          <span>{run.startedAt ? formatDate(run.startedAt) : ""}</span>
          <span>\u00b7</span>
          <span>Ad\u0131m {run.currentStep}/{TOTAL_STEPS}</span>
          <span>\u00b7</span>
          <span>{formatCost(run.totalCostUsd)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {run.status === "running" && onStop && (
          <Button variant="danger" size="sm" onClick={onStop}>
            Durdur
          </Button>
        )}
      </div>
    </div>
  );
}
