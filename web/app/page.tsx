import Link from "next/link";
import { listRuns } from "@/lib/file-utils";
import { getPipelineManager } from "@/lib/pipeline-manager";
import { RunCard } from "@/components/dashboard/run-card";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { RunStats } from "@/lib/types";

export const dynamic = "force-dynamic";

function computeStats(runs: ReturnType<typeof listRuns>): RunStats {
  const totalRuns = runs.length;
  const successfulRuns = runs.filter((r) => r.status === "completed").length;
  const failedRuns = runs.filter((r) => r.status === "failed").length;
  const runningRuns = runs.filter((r) => r.status === "running").length;
  const totalCostUsd = runs.reduce((sum, r) => sum + r.totalCostUsd, 0);
  const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;

  return { totalRuns, successfulRuns, failedRuns, runningRuns, totalCostUsd, successRate };
}

export default function DashboardPage() {
  const manager = getPipelineManager();
  const runs = listRuns(manager.activeRunId);
  const stats = computeStats(runs);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Pipeline \u00e7al\u0131\u015ft\u0131rmalar\u0131n\u0131z\u0131 buradan takip edin
          </p>
        </div>
        <Link href="/new">
          <Button>\ud83d\ude80 Yeni Pipeline</Button>
        </Link>
      </div>

      {runs.length > 0 ? (
        <>
          <StatsBar stats={stats} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {runs.map((run) => (
              <RunCard key={run.id} run={run} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon="\ud83c\udfed"
          title="Hen\u00fcz pipeline \u00e7al\u0131\u015ft\u0131r\u0131lmad\u0131"
          description="Bir kategori se\u00e7ip ilk pipeline'\u0131n\u0131z\u0131 ba\u015flat\u0131n. Otonom uygulama \u00fcretimi birka\u00e7 dakika i\u00e7inde ba\u015flayacak."
          action={
            <Link href="/new">
              <Button size="lg">\ud83d\ude80 Pipeline Ba\u015flat</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
