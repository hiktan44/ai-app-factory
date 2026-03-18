"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface LogViewerProps {
  content: string;
  isLive?: boolean;
}

function classifyLine(line: string): string {
  if (/ADIM \d+\/\d+:/.test(line)) return "text-terminal-step font-bold";
  if (/={3,}/.test(line)) return "text-edge";
  if (/Maliyet:/.test(line)) return "text-terminal-cost";
  if (/HATA:|hata olu/.test(line)) return "text-terminal-err";
  if (/UYARI:/.test(line)) return "text-yellow-400";
  if (/BA\u015eARILI|ba\u015far\u0131l\u0131|TAMAMLANDI|Tamamland\u0131/.test(line)) return "text-terminal-text";
  if (/Ba\u015flat\u0131l\u0131yor:/.test(line)) return "text-blue-300";
  if (/PIPELINE TAMAMLANDI/.test(line)) return "text-terminal-text font-bold";
  return "text-content-secondary";
}

export function LogViewer({ content, isLive = false }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const lines = useMemo(() => {
    return content.split("\n").filter((l) => l.trim());
  }, [content]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, autoScroll]);

  // Detect manual scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between bg-surface-tertiary rounded-t-lg px-4 py-2 border border-b-0 border-edge">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <span className="text-xs text-content-muted ml-2">
            pipeline.log
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot" />
              Canl\u0131
            </span>
          )}
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                if (containerRef.current) {
                  containerRef.current.scrollTop = containerRef.current.scrollHeight;
                }
              }}
              className="text-xs text-brand hover:text-brand-hover"
            >
              \u2193 Alta git
            </button>
          )}
          <span className="text-xs text-content-muted">
            {lines.length} sat\u0131r
          </span>
        </div>
      </div>

      {/* Log content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-terminal rounded-b-lg border border-edge p-4 font-mono text-xs leading-relaxed h-[500px] overflow-y-auto terminal-scrollbar"
      >
        {lines.length === 0 ? (
          <div className="text-content-muted italic">
            Henüz log yok. Pipeline ba\u015flat\u0131l\u0131yor...
          </div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={cn("py-0.5 whitespace-pre-wrap", classifyLine(line))}>
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
