import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PipelineRun } from "@/lib/types";
import { formatCost, formatDate, getCategoryLabel, getStatusLabel } from "@/lib/utils";
import { TOTAL_STEPS } from "@/lib/constants";

interface RunCardProps {
  run: PipelineRun;
}

export function RunCard({ run }: RunCardProps) {
  return (
    <Link href={`/runs/${run.id}`}>
      <Card hover className="h-full">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-[var(--color-text-primary)] truncate">
              {run.appName || run.id}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {getCategoryLabel(run.category)}
            </p>
          </div>
          <Badge status={run.status} label={getStatusLabel(run.status)} />
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
            <span>Ad\u0131m {run.currentStep}/{TOTAL_STEPS}</span>
            <span>{Math.round((run.currentStep / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500"
              style={{ width: `${(run.currentStep / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span>{run.timestamp ? formatDate(run.startedAt) : ""}</span>
          <span>{formatCost(run.totalCostUsd)}</span>
        </div>
      </Card>
    </Link>
  );
}
