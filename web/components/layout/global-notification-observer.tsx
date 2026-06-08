"use client";

import { useEffect, useRef } from "react";

interface RunItem {
  id: string;
  category: string;
  status: "running" | "completed" | "failed" | "stopped" | "queued" | string;
}

export function GlobalNotificationObserver() {
  const previousRunsRef = useRef<Record<string, string>>({}); // id -> status
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Request notification permission
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    // 2. Poll function
    const checkRuns = async () => {
      try {
        const res = await fetch("/api/runs");
        if (!res.ok) return;
        const data = await res.json() as { runs: RunItem[] };
        if (!data || !Array.isArray(data.runs)) return;

        const currentRuns: Record<string, string> = {};
        data.runs.forEach((run) => {
          currentRuns[run.id] = run.status;
        });

        // Compare with previous status
        const prevRuns = previousRunsRef.current;
        
        // Skip first load to avoid spamming notification for already completed runs
        const isFirstLoad = Object.keys(prevRuns).length === 0;

        if (!isFirstLoad) {
          for (const [id, status] of Object.entries(currentRuns)) {
            const prevStatus = prevRuns[id];
            
            // If it transitioned from running/queued to completed/failed/stopped
            if (prevStatus && prevStatus !== status) {
              const wasActive = prevStatus === "running" || prevStatus === "queued";
              const isFinished = status === "completed" || status === "failed" || status === "stopped";

              if (wasActive && isFinished && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                const category = id.split("_").slice(0, -2).join("_") || id;
                const statusText = status === "completed" 
                  ? "Başarıyla Tamamlandı! 🎉" 
                  : status === "failed" 
                    ? "Hata Alarak Durdu! ❌" 
                    : "Durduruldu. 🛑";

                new Notification("AI App Factory", {
                  body: `"${category}" projesi için orkestrasyon işlemi sonlandı.\nDurum: ${statusText}`,
                  icon: "/favicon.ico",
                  tag: id, // Prevent duplicate notifications
                });
              }
            }
          }
        }

        // Save current runs for next comparison
        previousRunsRef.current = currentRuns;
      } catch (err) {
        console.error("[GlobalNotificationObserver] error polling runs:", err);
      }
    };

    // Run immediately
    checkRuns();

    // Poll every 8 seconds
    intervalRef.current = setInterval(checkRuns, 8000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return null; // This component doesn't render anything
}
