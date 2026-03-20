import Link from "next/link";
import { listRuns } from "@/lib/file-utils";
import { getPipelineManager } from "@/lib/pipeline-manager";
import { RunCard } from "@/components/dashboard/run-card";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const runs = listRuns(manager.activeRunIds);
  const stats = computeStats(runs);
  const recentRuns = runs.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="gradient-text">AI App Factory</span>
          </h1>
          <p className="text-content-secondary mt-1">
            Otonom uygulama üretim bandınızı buradan yönetin
          </p>
        </div>
        <Link href="/new">
          <Button size="lg" className="animate-glow-pulse">
            <span className="text-lg">✨</span>
            Yeni Proje Oluştur
          </Button>
        </Link>
      </div>

      {/* Quick start card */}
      <Card className="p-0 overflow-hidden border-brand/20 animate-fade-in">
        <div className="relative bg-gradient-to-r from-brand/10 via-accent-blue/5 to-transparent p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand to-accent-blue flex items-center justify-center text-2xl shadow-lg shadow-brand-glow animate-float">
              🏭
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-content mb-1">
                Nasıl Çalışır?
              </h3>
              <p className="text-sm text-content-secondary max-w-2xl">
                Kategori seçin → AI fikir üretsin → Beğendiğiniz fikri onaylayın → 10 adımlı pipeline otomatik çalışsın → Hazır uygulamanız GitHub&apos;a push edilip Coolify&apos;da deploy edilsin.
              </p>
            </div>
            <Link href="/new">
              <Button variant="secondary">
                Başla →
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Stats */}
      {runs.length > 0 && <StatsBar stats={stats} />}

      {/* Recent Runs */}
      <div>
        <div className="flex items-center justify-between mb-4 animate-fade-in">
          <h2 className="text-lg font-semibold text-content">
            Son Pipeline'lar
          </h2>
          {runs.length > 6 && (
            <Link
              href="/runs"
              className="text-sm text-content-muted hover:text-content transition-colors flex items-center gap-1"
            >
              Tümünü gör →
            </Link>
          )}
        </div>

        {recentRuns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {recentRuns.map((run) => (
              <RunCard key={run.id} run={run} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🏭"
            title="Henüz pipeline çalıştırılmadı"
            description="Bir kategori seçip ilk projenizi oluşturun. AI fikir üretecek, siz onaylayacaksınız, sonra pipeline otomatik başlayacak."
            action={
              <Link href="/new">
                <Button size="lg">
                  <span className="text-lg">🚀</span>
                  İlk Projeyi Oluştur
                </Button>
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
