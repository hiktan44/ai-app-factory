import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PipelineRun } from "@/lib/types";
import { formatCost, formatDate, getCategoryLabel, getStatusLabel } from "@/lib/utils";
import { TOTAL_STEPS } from "@/lib/constants";

interface RunCardProps {
  run: PipelineRun;
  onStop?: (id: string) => void;
  onRestart?: (id: string) => void;
}

export function RunCard({ run, onStop, onRestart }: RunCardProps) {
  const progress = Math.round((run.currentStep / TOTAL_STEPS) * 100);
  const progressColor =
    run.status === "completed"
      ? "from-success to-accent-emerald"
      : run.status === "failed"
      ? "from-danger to-accent-rose"
      : "from-brand to-accent-blue";

  return (
    <Link href={`/runs/${run.id}`}>
      <Card hover className="h-full group">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-content truncate group-hover:text-brand-hover transition-colors">
              {run.appName || run.id}
            </h3>
            <p className="text-xs text-content-muted mt-0.5">
              {getCategoryLabel(run.category)}
            </p>
          </div>
          <Badge status={run.status} label={getStatusLabel(run.status)} />
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-content-muted mb-1.5">
            <span>Adım {run.currentStep}/{TOTAL_STEPS}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${progressColor} rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-content-muted">
          <span>{run.startedAt ? formatDate(run.startedAt) : ""}</span>
          <span className="font-mono">{formatCost(run.totalCostUsd)}</span>
        </div>

        {/* Kontrol Düğmeleri */}
        {(onStop || onRestart) && (
          <div className="mt-3 pt-3 border-t border-edge flex items-center gap-2">
            {onStop && (
              <Button
                variant="danger"
                size="sm"
                className="text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStop(run.id);
                }}
              >
                Durdur
              </Button>
            )}
            {onRestart && (
              <Button
                variant="secondary"
                size="sm"
                className="text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRestart(run.id);
                }}
              >
                Yeniden Başlat
              </Button>
            )}
          </div>
        )}
      </Card>
    </Link>
  );
}
