"use client";

import { cn } from "@/lib/utils";
import type { PipelineStep } from "@/lib/types";

interface StepProgressProps {
  steps: PipelineStep[];
  currentStep: number;
}

const statusStyles: Record<string, { circle: string; line: string }> = {
  pending: {
    circle: "border-edge bg-surface-tertiary text-content-muted",
    line: "bg-edge",
  },
  running: {
    circle: "border-blue-500 bg-blue-500/20 text-blue-400 ring-2 ring-blue-500/30",
    line: "bg-edge",
  },
  completed: {
    circle: "border-green-500 bg-green-500/20 text-green-400",
    line: "bg-green-500",
  },
  failed: {
    circle: "border-red-500 bg-red-500/20 text-red-400",
    line: "bg-red-500",
  },
  skipped: {
    circle: "border-edge bg-surface-tertiary text-content-muted",
    line: "bg-edge",
  },
};

export function StepProgress({ steps, currentStep }: StepProgressProps) {
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center min-w-[700px]">
        {steps.map((step, idx) => {
          const styles = statusStyles[step.status] || statusStyles.pending;
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.number} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
                    styles.circle,
                    step.status === "running" && "animate-pulse-dot",
                  )}
                >
                  {step.status === "completed" ? (
                    "\u2713"
                  ) : step.status === "failed" ? (
                    "\u2717"
                  ) : (
                    step.number
                  )}
                </div>
                <span className="mt-1.5 text-[10px] text-content-muted text-center max-w-[80px] leading-tight">
                  {step.label}
                </span>
                {step.costUsd !== undefined && step.costUsd > 0 && (
                  <span className="mt-0.5 text-[9px] text-terminal-cost">
                    ${step.costUsd.toFixed(3)}
                  </span>
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-1",
                    step.status === "completed" ? styles.line : "bg-edge",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
