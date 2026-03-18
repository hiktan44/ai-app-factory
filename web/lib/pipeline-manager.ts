import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import type { QueueItem, WebRunMeta } from "./types";
import { getProjectRoot, getRunsDir, getOrchestratorPath } from "./file-utils";

class PipelineManager {
  private currentProcess: ChildProcess | null = null;
  private currentRunId: string | null = null;
  private queue: QueueItem[] = [];

  constructor() {
    // Cleanup on server shutdown
    const cleanup = () => this.cleanup();
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Detect orphaned runs on startup
    this.detectOrphanedRuns();
  }

  get isRunning(): boolean {
    return this.currentProcess !== null;
  }

  get activeRunId(): string | null {
    return this.currentRunId;
  }

  async startRun(category: string): Promise<{ runId: string; queued: boolean }> {
    const timestamp = this.formatTimestamp(new Date());
    const runId = `${category}_${timestamp}`;

    if (this.isRunning) {
      this.queue.push({
        id: runId,
        category,
        requestedAt: new Date().toISOString(),
      });
      return { runId, queued: true };
    }

    this.spawnProcess(runId, category);
    return { runId, queued: false };
  }

  stopRun(runId: string): boolean {
    if (this.currentRunId !== runId || !this.currentProcess) return false;

    this.currentProcess.kill("SIGTERM");

    // Give it 5 seconds, then SIGKILL
    const proc = this.currentProcess;
    setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        // Process already dead
      }
    }, 5000);

    this.updateMeta(runId, { status: "stopped", completedAt: new Date().toISOString() });

    this.currentProcess = null;
    this.currentRunId = null;

    // Process next in queue
    this.processQueue();

    return true;
  }

  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  removeFromQueue(runId: string): boolean {
    const idx = this.queue.findIndex((q) => q.id === runId);
    if (idx === -1) return false;
    this.queue.splice(idx, 1);
    return true;
  }

  private spawnProcess(runId: string, category: string): void {
    const projectRoot = getProjectRoot();
    const orchestratorPath = getOrchestratorPath();

    // Pre-create workspace for meta file
    const workspace = path.join(getRunsDir(), runId);
    fs.mkdirSync(workspace, { recursive: true });

    const meta: WebRunMeta = {
      startedAt: new Date().toISOString(),
      startedBy: "web-ui",
      category,
      runId,
      status: "running",
      pid: null,
    };
    fs.writeFileSync(path.join(workspace, "web-run-meta.json"), JSON.stringify(meta, null, 2));

    const child = spawn("bash", [orchestratorPath, category], {
      cwd: projectRoot,
      env: {
        ...process.env,
        HOME: process.env.HOME || "",
        PATH: process.env.PATH || "",
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    // Update PID in meta
    meta.pid = child.pid || null;
    fs.writeFileSync(path.join(workspace, "web-run-meta.json"), JSON.stringify(meta, null, 2));

    this.currentProcess = child;
    this.currentRunId = runId;

    // Log stdout/stderr to files for debugging
    const stdoutLog = path.join(workspace, "web-stdout.log");
    const stderrLog = path.join(workspace, "web-stderr.log");

    child.stdout?.on("data", (data: Buffer) => {
      fs.appendFileSync(stdoutLog, data);
    });

    child.stderr?.on("data", (data: Buffer) => {
      fs.appendFileSync(stderrLog, data);
    });

    child.on("exit", (code) => {
      this.updateMeta(runId, {
        status: code === 0 ? "completed" : "failed",
        completedAt: new Date().toISOString(),
        exitCode: code,
      });

      this.currentProcess = null;
      this.currentRunId = null;

      // Process next in queue
      this.processQueue();
    });

    child.on("error", (error) => {
      console.error(`Pipeline ${runId} error:`, error.message);
      this.updateMeta(runId, {
        status: "failed",
        completedAt: new Date().toISOString(),
      });

      this.currentProcess = null;
      this.currentRunId = null;

      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.isRunning || this.queue.length === 0) return;
    const next = this.queue.shift();
    if (next) {
      this.spawnProcess(next.id, next.category);
    }
  }

  private updateMeta(runId: string, updates: Partial<WebRunMeta>): void {
    const workspace = path.join(getRunsDir(), runId);
    const metaPath = path.join(workspace, "web-run-meta.json");
    try {
      const existing = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as WebRunMeta;
      const updated = { ...existing, ...updates };
      fs.writeFileSync(metaPath, JSON.stringify(updated, null, 2));
    } catch {
      // Meta file might not exist for CLI-initiated runs
    }
  }

  private detectOrphanedRuns(): void {
    const runsDir = getRunsDir();
    if (!fs.existsSync(runsDir)) return;

    try {
      const entries = fs.readdirSync(runsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const metaPath = path.join(runsDir, entry.name, "web-run-meta.json");
        if (!fs.existsSync(metaPath)) continue;

        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as WebRunMeta;
          if (meta.status === "running" && meta.pid) {
            // Check if process is still alive
            try {
              process.kill(meta.pid, 0);
              // Process is alive — it might be from a different server instance
              // Mark as stopped to be safe
            } catch {
              // Process is dead — mark as stopped
              this.updateMeta(entry.name, {
                status: "stopped",
                completedAt: new Date().toISOString(),
              });
            }
          }
        } catch {
          // Invalid meta file
        }
      }
    } catch {
      // Runs dir might not be readable
    }
  }

  private formatTimestamp(date: Date): string {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${y}${mo}${d}_${h}${mi}${s}`;
  }

  private cleanup(): void {
    if (this.currentProcess) {
      try {
        this.currentProcess.kill("SIGTERM");
      } catch {
        // Already dead
      }
      if (this.currentRunId) {
        this.updateMeta(this.currentRunId, {
          status: "stopped",
          completedAt: new Date().toISOString(),
        });
      }
    }
  }
}

// HMR-safe singleton using globalThis
const globalForManager = globalThis as unknown as { pipelineManager: PipelineManager };

export function getPipelineManager(): PipelineManager {
  if (!globalForManager.pipelineManager) {
    globalForManager.pipelineManager = new PipelineManager();
  }
  return globalForManager.pipelineManager;
}
