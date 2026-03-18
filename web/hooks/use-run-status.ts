"use client";

import { useEffect, useState, useCallback } from "react";
import type { PipelineRun } from "@/lib/types";

export function useRunStatus(runId: string | null, intervalMs = 3000) {
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRun = useCallback(async () => {
    if (!runId) return;
    try {
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) throw new Error("Run bulunamad\u0131");
      const data = await res.json();
      setRun(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchRun();
    const interval = setInterval(fetchRun, intervalMs);
    return () => clearInterval(interval);
  }, [fetchRun, intervalMs]);

  return { run, loading, error, refetch: fetchRun };
}
