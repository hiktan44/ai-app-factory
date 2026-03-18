"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { SSEMessage } from "@/lib/types";

export function useEventSource(url: string | null) {
  const [logs, setLogs] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const close = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!url) return;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setIsConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEMessage;
        if (data.type === "initial") {
          setLogs(data.content || "");
        } else if (data.type === "append") {
          setLogs((prev) => prev + (data.content || ""));
        } else if (data.type === "complete") {
          setIsComplete(true);
          es.close();
          setIsConnected(false);
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [url]);

  return { logs, isConnected, isComplete, close };
}
