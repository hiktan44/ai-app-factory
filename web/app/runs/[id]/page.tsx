"use client";

import { use, useMemo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useEventSource } from "@/hooks/use-event-source";
import { useRunStatus } from "@/hooks/use-run-status";
import { parseLogContent } from "@/lib/run-parser";
import { RunHeader } from "@/components/run-detail/run-header";
import { StepProgress } from "@/components/run-detail/step-progress";
import { LogViewer } from "@/components/run-detail/log-viewer";
import { CostTracker } from "@/components/run-detail/cost-tracker";
import { ArtifactBrowser } from "@/components/run-detail/artifact-browser";
import { DebugFixPanel } from "@/components/run-detail/debug-fix-panel";
import { PIPELINE_STEPS } from "@/lib/constants";

export default function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);

  // Fetch run metadata periodically
  const { run, loading } = useRunStatus(id, 5000);

  // SSE for live logs
  const { logs, isConnected, isComplete } = useEventSource(`/api/runs/${id}/stream`);

  // Parse logs client-side for real-time step progress
  const parsed = useMemo(() => {
    if (!logs) {
      return {
        steps: PIPELINE_STEPS.map((s) => ({
          ...s,
          status: "pending" as const,
        })),
        currentStep: 0,
        totalCostUsd: 0,
        isComplete: false,
      };
    }
    return parseLogContent(logs);
  }, [logs]);

  const handleStop = useCallback(async () => {
    try {
      await fetch(`/api/runs/${id}/stop`, { method: "POST" });
    } catch (err) {
      console.error("Failed to stop run:", err);
    }
  }, [id]);

  const handleRestart = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${id}/restart`, { method: "POST" });
      const data = await res.json();
      if (data.newRunId) {
        router.push(`/runs/${data.newRunId}`);
      }
    } catch (err) {
      console.error("Failed to restart run:", err);
    }
  }, [id, router]);

  const handleDeploy = useCallback(async () => {
    setIsDeploying(true);
    setDeployMessage(null);
    try {
      const res = await fetch(`/api/runs/${id}/deploy`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setDeployMessage(`❌ ${data.error}`);
      } else {
        setDeployMessage(`✅ Deploy başlatıldı! ${data.deployUrl || ""}`);
      }
    } catch (err) {
      setDeployMessage(`❌ Deploy hatası: ${err}`);
    } finally {
      setIsDeploying(false);
    }
  }, [id]);

  const isRunning = run?.status === "running" || (isConnected && !isComplete);
  const isCompleted = run?.status === "completed" || run?.status === "failed";

  if (loading && !run) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-surface-card rounded-xl animate-pulse" />
        <div className="h-12 bg-surface-card rounded-xl animate-pulse" />
        <div className="h-[500px] bg-surface-card rounded-xl animate-pulse" />
      </div>
    );
  }

  // Use parsed data for real-time, fall back to run data
  const steps = parsed.steps.length > 0 ? parsed.steps : run?.steps || [];
  const currentStep = parsed.currentStep || run?.currentStep || 0;
  const totalCost = parsed.totalCostUsd || run?.totalCostUsd || 0;

  // Build a run-like object for header
  const headerRun = run || {
    id,
    category: id.split("_").slice(0, -2).join("_"),
    timestamp: "",
    startedAt: "",
    status: isRunning ? ("running" as const) : ("stopped" as const),
    currentStep,
    steps,
    totalCostUsd: totalCost,
    workspace: "",
    hasProductSpec: false,
    hasReviewReport: false,
  };

  return (
    <div className="space-y-6">
      <RunHeader
        run={headerRun}
        onStop={isRunning ? handleStop : undefined}
        onRestart={!isRunning ? handleRestart : undefined}
        onDeploy={isCompleted ? handleDeploy : undefined}
        isDeploying={isDeploying}
      />

      {/* Deploy message */}
      {deployMessage && (
        <div
          className={`px-4 py-3 rounded-xl text-sm ${
            deployMessage.startsWith("✅")
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-danger/10 border border-danger/20 text-danger"
          }`}
        >
          {deployMessage}
        </div>
      )}

      <StepProgress steps={steps} currentStep={currentStep} />

      {/* Debug/Fix Panel — only for completed/failed runs */}
      {isCompleted && <DebugFixPanel runId={id} isCompleted={isCompleted} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LogViewer content={logs} isLive={isRunning} />
        </div>
        <div className="space-y-4">
          <CostTracker steps={steps} totalCost={totalCost} />
          <ArtifactBrowser runId={id} />
        </div>
      </div>
    </div>
  );
}
