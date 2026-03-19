import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import type { QueueItem, WebRunMeta } from "./types";
import { getProjectRoot, getRunsDir, getOrchestratorPath } from "./file-utils";
import {
  ensureSchema,
  dbUpsertRun,
  dbUpdateRun,
  dbGetRunningRun,
  dbGetQueue,
  dbEnqueue,
  dbDequeue,
  dbRemoveFromQueue,
  dbClearQueue,
} from "./db";

class PipelineManager {
  private currentProcess: ChildProcess | null = null;
  private currentRunId: string | null = null;
  private queue: QueueItem[] = [];
  private initialized = false;

  constructor() {
    // Cleanup on server shutdown
    const cleanup = () => this.cleanup();
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Async init: schema + orphan detection + queue recovery
    this.init().catch((err) => console.error("[PipelineManager] init error:", err));
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Ensure DB schema exists
    await ensureSchema();

    // 2. Detect orphaned runs from previous server instance
    await this.detectOrphanedRuns();

    // 3. Reload persisted queue from DB
    await this.reloadQueue();

    // 4. If nothing is running, start processing queue
    if (!this.isRunning && this.queue.length > 0) {
      await this.processQueue();
    }
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

    // Persist to DB immediately
    await dbUpsertRun({ id: runId, category, status: "queued" });

    if (this.isRunning) {
      const item: QueueItem = {
        id: runId,
        category,
        requestedAt: new Date().toISOString(),
      };
      this.queue.push(item);
      // Persist queue item to DB
      await dbEnqueue({ id: runId, run_id: runId, category });
      return { runId, queued: true };
    }

    this.spawnProcess(runId, category);
    return { runId, queued: false };
  }

  async startRunWithSpec(category: string, productSpec: string, appName: string): Promise<{ runId: string; queued: boolean }> {
    const timestamp = this.formatTimestamp(new Date());
    const runId = `${category}_${timestamp}`;

    // Pre-create workspace and write the product spec
    const workspace = path.join(getRunsDir(), runId);
    fs.mkdirSync(workspace, { recursive: true });
    fs.writeFileSync(path.join(workspace, "product-spec.md"), productSpec, "utf-8");

    // Write a flag file so orchestrator knows to skip discovery
    fs.writeFileSync(
      path.join(workspace, "pre-approved.json"),
      JSON.stringify({ appName, category, approvedAt: new Date().toISOString() }, null, 2),
    );

    // Persist to DB
    await dbUpsertRun({ id: runId, category, status: "queued", has_spec: true });

    if (this.isRunning) {
      const item: QueueItem = {
        id: runId,
        category,
        requestedAt: new Date().toISOString(),
      };
      this.queue.push(item);
      await dbEnqueue({ id: runId, run_id: runId, category });
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
    dbUpdateRun(runId, { status: "stopped", completed_at: new Date().toISOString() }).catch(() => {});

    this.currentProcess = null;
    this.currentRunId = null;

    // Process next in queue
    this.processQueue().catch(() => {});

    return true;
  }

  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  removeFromQueue(runId: string): boolean {
    const idx = this.queue.findIndex((q) => q.id === runId);
    if (idx === -1) return false;
    this.queue.splice(idx, 1);
    dbRemoveFromQueue(runId).catch(() => {});
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
        RUN_ID: runId,
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    // Update PID in meta and DB
    meta.pid = child.pid || null;
    fs.writeFileSync(path.join(workspace, "web-run-meta.json"), JSON.stringify(meta, null, 2));

    dbUpdateRun(runId, {
      status: "running",
      started_at: meta.startedAt,
      pid: meta.pid ?? undefined,
    }).catch(() => {});

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
      const status = code === 0 ? "completed" : "failed";
      this.updateMeta(runId, {
        status,
        completedAt: new Date().toISOString(),
        exitCode: code,
      });

      dbUpdateRun(runId, {
        status,
        completed_at: new Date().toISOString(),
        exit_code: code ?? undefined,
      }).catch(() => {});

      this.currentProcess = null;
      this.currentRunId = null;

      // Process next in queue
      this.processQueue().catch(() => {});
    });

    child.on("error", (error) => {
      console.error(`Pipeline ${runId} error:`, error.message);
      this.updateMeta(runId, {
        status: "failed",
        completedAt: new Date().toISOString(),
      });

      dbUpdateRun(runId, {
        status: "failed",
        completed_at: new Date().toISOString(),
      }).catch(() => {});

      this.currentProcess = null;
      this.currentRunId = null;

      this.processQueue().catch(() => {});
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isRunning || this.queue.length === 0) return;

    // Try in-memory queue first
    const next = this.queue.shift();
    if (next) {
      // Remove from DB queue
      await dbRemoveFromQueue(next.id);
      this.spawnProcess(next.id, next.category);
    }
  }

  private async reloadQueue(): Promise<void> {
    // Reload queue items from DB that are still queued
    const dbQueue = await dbGetQueue();
    for (const item of dbQueue) {
      const alreadyInMemory = this.queue.some((q) => q.id === item.run_id);
      if (!alreadyInMemory) {
        // Check if the run workspace still exists (so we can actually resume it)
        const workspace = path.join(getRunsDir(), item.run_id);
        if (fs.existsSync(workspace)) {
          this.queue.push({
            id: item.run_id,
            category: item.category,
            requestedAt: item.requested_at,
          });
          console.log(`[PipelineManager] Reloaded queued run from DB: ${item.run_id}`);
        } else {
          // Workspace gone (container restart wiped it?) — remove from queue
          await dbRemoveFromQueue(item.run_id);
          await dbUpdateRun(item.run_id, { status: "stopped", completed_at: new Date().toISOString() });
        }
      }
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

  private async detectOrphanedRuns(): Promise<void> {
    // Check DB for any "running" runs that were left over from previous instance
    const running = await dbGetRunningRun();
    if (running) {
      // Check if the PID is actually alive in THIS container instance
      let isAlive = false;
      if (running.pid) {
        try {
          process.kill(running.pid, 0);
          isAlive = true;
        } catch {
          isAlive = false;
        }
      }

      if (!isAlive) {
        // Process is dead — mark as stopped
        await dbUpdateRun(running.id, {
          status: "stopped",
          completed_at: new Date().toISOString(),
        });
        this.updateMeta(running.id, {
          status: "stopped",
          completedAt: new Date().toISOString(),
        });
        console.log(`[PipelineManager] Marked orphaned run as stopped: ${running.id}`);
      }
    }

    // Also scan filesystem for "running" meta files
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
            try {
              process.kill(meta.pid, 0);
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
        dbUpdateRun(this.currentRunId, {
          status: "stopped",
          completed_at: new Date().toISOString(),
        }).catch(() => {});
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
