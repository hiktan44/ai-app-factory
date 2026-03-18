"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import type { RunArtifact } from "@/lib/types";

interface ArtifactBrowserProps {
  runId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(ext: string): string {
  const icons: Record<string, string> = {
    ".ts": "\ud83d\udcdc",
    ".tsx": "\u269b\ufe0f",
    ".js": "\ud83d\udfe8",
    ".json": "\ud83d\udccb",
    ".md": "\ud83d\udcd6",
    ".css": "\ud83c\udfa8",
    ".html": "\ud83c\udf10",
    ".svg": "\ud83d\uddbc\ufe0f",
    ".png": "\ud83d\uddbc\ufe0f",
    ".jpg": "\ud83d\uddbc\ufe0f",
    ".sh": "\u2699\ufe0f",
    ".yml": "\ud83d\udce6",
    ".yaml": "\ud83d\udce6",
    ".dockerfile": "\ud83d\udc33",
    ".log": "\ud83d\udcdd",
    ".txt": "\ud83d\udcc4",
  };
  return icons[ext] || "\ud83d\udcc4";
}

export function ArtifactBrowser({ runId }: ArtifactBrowserProps) {
  const [artifacts, setArtifacts] = useState<RunArtifact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/runs/${runId}/artifacts`)
      .then((res) => res.json())
      .then((data) => setArtifacts(data.artifacts || []))
      .catch(() => setArtifacts([]))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-surface-tertiary rounded" />
          ))}
        </div>
      </Card>
    );
  }

  // Group by top-level directory
  const grouped = new Map<string, RunArtifact[]>();
  for (const art of artifacts) {
    const topDir = art.path.split("/")[0];
    if (!grouped.has(topDir)) grouped.set(topDir, []);
    grouped.get(topDir)?.push(art);
  }

  const dirs = artifacts.filter((a) => a.type === "directory" && !a.path.includes("/"));
  const topFiles = artifacts.filter((a) => a.type === "file" && !a.path.includes("/"));

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium text-content mb-3">
        \ud83d\udcc2 \u00dcretilen Dosyalar
      </h3>
      <div className="space-y-1 text-xs font-mono">
        {/* Top-level files */}
        {topFiles.map((file) => (
          <div
            key={file.path}
            className="flex items-center justify-between py-1 px-2 rounded hover:bg-surface-tertiary"
          >
            <span className="text-content-secondary">
              {getFileIcon(file.extension || "")} {file.name}
            </span>
            {file.size !== undefined && (
              <span className="text-content-muted">
                {formatSize(file.size)}
              </span>
            )}
          </div>
        ))}

        {/* Directories */}
        {dirs.map((dir) => {
          const children = artifacts.filter(
            (a) => a.path.startsWith(dir.name + "/") && a.type === "file",
          );
          return (
            <details key={dir.path} className="group">
              <summary className="flex items-center justify-between py-1 px-2 rounded cursor-pointer hover:bg-surface-tertiary">
                <span className="text-brand">
                  \ud83d\udcc1 {dir.name}/
                </span>
                <span className="text-content-muted">
                  {children.length} dosya
                </span>
              </summary>
              <div className="ml-4 border-l border-edge pl-2">
                {children.slice(0, 20).map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center justify-between py-0.5 px-2 text-content-secondary"
                  >
                    <span className="truncate">
                      {getFileIcon(file.extension || "")} {file.name}
                    </span>
                    {file.size !== undefined && (
                      <span className="text-content-muted ml-2 shrink-0">
                        {formatSize(file.size)}
                      </span>
                    )}
                  </div>
                ))}
                {children.length > 20 && (
                  <div className="py-0.5 px-2 text-content-muted italic">
                    ...ve {children.length - 20} dosya daha
                  </div>
                )}
              </div>
            </details>
          );
        })}

        {artifacts.length === 0 && (
          <div className="text-content-muted italic py-2">
            Hen\u00fcz dosya \u00fcretilmedi
          </div>
        )}
      </div>
    </Card>
  );
}
