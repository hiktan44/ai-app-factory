"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RunCard } from "@/components/dashboard/run-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PipelineRun, QueueItem } from "@/lib/types";
import { getCategoryLabel } from "@/lib/utils";

interface RunsResponse {
  runs: PipelineRun[];
  queue: QueueItem[];
  activeRunIds: string[];
  runningCount: number;
  maxConcurrent: number;
}

export default function RunsPage() {
  const router = useRouter();
  const [data, setData] = useState<RunsResponse>({
    runs: [],
    queue: [],
    activeRunIds: [],
    runningCount: 0,
    maxConcurrent: 1,
  });
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/runs");
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, [fetchRuns]);

  const handleStop = useCallback(async (id: string) => {
    try {
      await fetch(`/api/runs/${id}/stop`, { method: "POST" });
      await fetchRuns();
    } catch (err) {
      console.error("Durdurma başarısız:", err);
    }
  }, [fetchRuns]);

  const handleRestart = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/runs/${id}/restart`, { method: "POST" });
      const result = await res.json();
      if (result.newRunId) {
        router.push(`/runs/${result.newRunId}`);
      }
      await fetchRuns();
    } catch (err) {
      console.error("Yeniden başlatma başarısız:", err);
    }
  }, [fetchRuns, router]);

  const handleQueueRemove = useCallback(async (id: string) => {
    try {
      await fetch(`/api/runs/${id}/queue-remove`, { method: "POST" });
      await fetchRuns();
    } catch (err) {
      console.error("Kuyruktan çıkarma başarısız:", err);
    }
  }, [fetchRuns]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/runs/${id}/delete`, { method: "POST" });
      if (res.ok) {
        await fetchRuns();
      } else {
        const err = await res.json();
        alert(err.error || "Silme başarısız");
      }
    } catch (err) {
      console.error("Silme başarısız:", err);
    }
  }, [fetchRuns]);

  const { runs, queue, runningCount, maxConcurrent } = data;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-16 bg-surface-card rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-surface-card rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-content">
            Pipeline&apos;lar
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

      {/* Durum Bilgisi */}
      {(runningCount > 0 || queue.length > 0) && (
        <Card className="p-4 animate-fade-in">
          <div className="flex items-center gap-4 text-sm">
            {runningCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-content">
                  {runningCount}/{maxConcurrent} pipeline çalışıyor
                </span>
              </div>
            )}
            {queue.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-content-secondary">
                  {queue.length} kuyrukta bekliyor
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Kuyruk */}
      {queue.length > 0 && (
        <div className="animate-fade-in">
          <h2 className="text-sm font-semibold text-content-secondary mb-3">Kuyrukta Bekleyenler</h2>
          <div className="space-y-2">
            {queue.map((item, idx) => (
              <Card key={item.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-content-muted font-mono">#{idx + 1}</span>
                  <div>
                    <span className="text-sm font-medium text-content">{getCategoryLabel(item.category)}</span>
                    <span className="text-xs text-content-muted ml-2">{item.id}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleQueueRemove(item.id)}
                >
                  ✕ Çıkar
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {runs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {runs.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              onStop={run.status === "running" ? handleStop : undefined}
              onRestart={run.status === "stopped" || run.status === "failed" ? handleRestart : undefined}
              onDelete={run.status !== "running" ? handleDelete : undefined}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="⚡"
          title="Henüz pipeline yok"
          description="İlk pipeline'ınızı başlatmak için yeni proje oluşturun."
          action={
            <Link href="/new">
              <Button size="lg">İlk Pipeline&apos;ı Başlat</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
