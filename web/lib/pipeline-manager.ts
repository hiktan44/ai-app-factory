import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import type { QueueItem, WebRunMeta } from "./types";
import { getProjectRoot, getRunsDir, getOrchestratorPath } from "./file-utils";
import { readSettings } from "./settings";
import {
  ensureSchema,
  dbUpsertRun,
  dbUpdateRun,
  dbGetRunningRun,
  dbGetRunningRuns,
  dbGetQueue,
  dbEnqueue,
  dbDequeue,
  dbRemoveFromQueue,
  dbClearQueue,
} from "./db";

class PipelineManager {
  private activeProcesses: Map<string, ChildProcess> = new Map();
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

    // 4. If capacity available, start processing queue
    if (!this.isFull && this.queue.length > 0) {
      await this.processQueue();
    }
  }

  get isRunning(): boolean {
    return this.activeProcesses.size > 0;
  }

  get activeRunId(): string | null {
    // İlk aktif run'ı döndür (geriye uyumluluk)
    const first = this.activeProcesses.keys().next();
    return first.done ? null : first.value;
  }

  get activeRunIds(): string[] {
    return Array.from(this.activeProcesses.keys());
  }

  get runningCount(): number {
    return this.activeProcesses.size;
  }

  private get maxConcurrent(): number {
    try {
      const settings = readSettings();
      return settings.maxConcurrentRuns || 1;
    } catch {
      return 1;
    }
  }

  private get isFull(): boolean {
    return this.activeProcesses.size >= this.maxConcurrent;
  }

  async startRun(category: string): Promise<{ runId: string; queued: boolean }> {
    const timestamp = this.formatTimestamp(new Date());
    const runId = `${category}_${timestamp}`;

    // Persist to DB immediately
    await dbUpsertRun({ id: runId, category, status: "queued" });

    if (this.isFull) {
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

    if (this.isFull) {
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
    const proc = this.activeProcesses.get(runId);
    if (!proc) return false;

    proc.kill("SIGTERM");

    // Give it 5 seconds, then SIGKILL
    setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        // Process already dead
      }
    }, 5000);

    this.updateMeta(runId, { status: "stopped", completedAt: new Date().toISOString() });
    dbUpdateRun(runId, { status: "stopped", completed_at: new Date().toISOString() }).catch(() => {});

    this.activeProcesses.delete(runId);

    // Process next in queue
    this.processQueue().catch(() => {});

    return true;
  }

  /**
   * Durdurulan veya başarısız olan bir run'ı yeniden başlatır.
   * Eski run'daki product-spec.md ve pre-approved.json varsa yeni run'a kopyalar.
   */
  async restartRun(runId: string): Promise<{ newRunId: string; queued: boolean } | null> {
    // Eski run'ın kategori bilgisini runId'den çıkar (format: category_YYYYMMDD_HHmmss)
    const parts = runId.split("_");
    if (parts.length < 3) return null;
    // Son iki parça tarih/saat, geri kalanı kategori
    const category = parts.slice(0, parts.length - 2).join("_");
    if (!category) return null;

    // Check if old run had a custom product spec
    const oldWorkspace = path.join(getRunsDir(), runId);
    const oldSpecPath = path.join(oldWorkspace, "product-spec.md");
    const oldPreApproved = path.join(oldWorkspace, "pre-approved.json");

    if (fs.existsSync(oldSpecPath) && fs.existsSync(oldPreApproved)) {
      // Restart with the same spec
      const spec = fs.readFileSync(oldSpecPath, "utf-8");
      let appName = category;
      try {
        const preApproved = JSON.parse(fs.readFileSync(oldPreApproved, "utf-8"));
        appName = preApproved.appName || category;
      } catch {
        // Use category as fallback
      }
      const result = await this.startRunWithSpec(category, spec, appName);
      return { newRunId: result.runId, queued: result.queued };
    }

    const { runId: newRunId, queued } = await this.startRun(category);
    return { newRunId, queued };
  }

  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  removeFromQueue(runId: string): boolean {
    const idx = this.queue.findIndex((q) => q.id === runId);
    if (idx === -1) return false;
    this.queue.splice(idx, 1);
    dbRemoveFromQueue(runId).catch(() => {});
    // Update DB status to stopped
    dbUpdateRun(runId, { status: "stopped", completed_at: new Date().toISOString() }).catch(() => {});
    return true;
  }

  private spawnProcess(runId: string, category: string): void {
    const projectRoot = getProjectRoot();
    const orchestratorPath = getOrchestratorPath();

    // Read settings for maxTurns
    let maxTurns = 50;
    try {
      const settings = readSettings();
      maxTurns = settings.maxTurns || 50;
    } catch {
      // Use default
    }

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
        MAX_TURNS: String(maxTurns),
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

    this.activeProcesses.set(runId, child);

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

      this.activeProcesses.delete(runId);

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

      this.activeProcesses.delete(runId);

      this.processQueue().catch(() => {});
    });
  }

  private async processQueue(): Promise<void> {
    // Fill available slots from queue
    while (!this.isFull && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        // Remove from DB queue
        await dbRemoveFromQueue(next.id);
        this.spawnProcess(next.id, next.category);
      }
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
    // Check DB for ALL "running" runs that were left over from previous instance
    const runningRuns = await dbGetRunningRuns();
    for (const running of runningRuns) {
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
    for (const [runId, proc] of this.activeProcesses) {
      try {
        proc.kill("SIGTERM");
      } catch {
        // Already dead
      }
      this.updateMeta(runId, {
        status: "stopped",
        completedAt: new Date().toISOString(),
      });
      dbUpdateRun(runId, {
        status: "stopped",
        completed_at: new Date().toISOString(),
      }).catch(() => {});
    }
    this.activeProcesses.clear();
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
