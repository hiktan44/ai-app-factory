"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PipelineRun } from "@/lib/types";
import { formatCost, formatDate, getCategoryLabel, getStatusLabel } from "@/lib/utils";
import { TOTAL_STEPS } from "@/lib/constants";

interface RunHeaderProps {
    run: PipelineRun;
    onStop?: () => void;
    onRestart?: () => void;
    onDeploy?: () => void;
    onRunApp?: () => void;
    isDeploying?: boolean;
    isLaunching?: boolean;
}

export function RunHeader({
    run,
    onStop,
    onRestart,
    onDeploy,
    onRunApp,
    isDeploying,
    isLaunching,
}: RunHeaderProps) {
    return (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                        <div className="flex items-center gap-3 mb-1">
                                  <h1 className="text-xl font-bold text-content">
                                    {run.appName || run.id}
                                  </h1>h1>
                                  <Badge status={run.status} label={getStatusLabel(run.status)} />
                        </div>div>
                        <div className="flex items-center gap-4 text-sm text-content-muted">
                                  <span>{getCategoryLabel(run.category)}</span>span>
                                  <span>&middot;</span>span>
                                  <span>{run.startedAt ? formatDate(run.startedAt) : ""}</span>span>
                                  <span>&middot;</span>span>
                                  <span>Adim {run.currentStep}/{TOTAL_STEPS}</span>span>
                                  <span>&middot;</span>
                                  <span>{formatCost(run.totalCostUsd)}</span>span>
                        </div>div>
                </div>div>
                <div className="flex items-center gap-2 flex-wrap">
                  {run.hasProductSpec && (
                      <>
                                  <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => {
                                                                    window.location.href = `/api/runs/${run.id}/download?format=md&file=product-spec.md`;
                                                  }}
                                                >
                                                .md
                                  </Button>Button>
                                  <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => {
                                                                    window.open(
                                                                                        `/api/runs/${run.id}/download?format=pdf&file=product-spec.md`,
                                                                                        "_blank",
                                                                                      );
                                                  }}
                                                >
                                                .pdf
                                  </Button>Button>
                      </>>
                    )}
                  {run.status === "completed" && onRunApp && (
                      <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={onRunApp}
                                    disabled={isLaunching}
                                  >
                        {isLaunching
                                        ? "Baslatiliyor..."
                                        : run.deployUrl
                                          ? "Uygulamayi Ac"
                                          : "Uygulamayi Calistir"}
                      </Button>Button>
                        )}
                  {run.deployUrl && (
                      <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(run.deployUrl, "_blank")}
                                  >
                                  Canli Site
                      </Button>Button>
                        )}
                  {run.status === "completed" && onDeploy && (
                      <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onDeploy}
                                    disabled={isDeploying}
                                  >
                        {isDeploying ? "Deploy..." : run.deployUrl ? "Yeniden Deploy" : "Deploy Et"}
                      </Button>Button>
                        )}
                  {run.status === "running" && onStop && (
                      <Button variant="danger" size="sm" onClick={onStop}>
                                  Durdur
                      </Button>Button>
                        )}
                  {(run.status === "stopped" || run.status === "failed") && onRestart && (
                      <Button variant="primary" size="sm" onClick={onRestart}>
                                  Yeniden Baslat
                      </Button>Button>
                        )}
                </div>div>
          </div>div>
        );
}
</></div>
