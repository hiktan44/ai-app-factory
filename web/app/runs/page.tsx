import Link from "next/link";
import { listRuns } from "@/lib/file-utils";
import { getPipelineManager } from "@/lib/pipeline-manager";
import { RunCard } from "@/components/dashboard/run-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function RunsPage() {
  const manager = getPipelineManager();
  const runs = listRuns(manager.activeRunId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-content">
            Pipeline'lar
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Tüm pipeline çalıştırmalarınız ({runs.length} adet)
          </p>
        </div>
        <Link href="/new">
          <Button>
            <span>✨</span>
            Yeni Pipeline
          </Button>
        </Link>
      </div>

      {runs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="⚡"
          title="Henüz pipeline yok"
          description="İlk pipeline'ınızı başlatmak için yeni proje oluşturun."
          action={
            <Link href="/new">
              <Button size="lg">🚀 İlk Pipeline'ı Başlat</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
