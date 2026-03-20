import fs from "fs";
import path from "path";
import type { PipelineRun, RunArtifact, RunStatus, WebRunMeta } from "./types";
import { parseLogContent } from "./run-parser";
import { extractCategoryFromRunId, extractTimestampFromRunId } from "./utils";

export function getProjectRoot(): string {
  const envRoot = process.env.PROJECT_ROOT;
  if (envRoot) {
    return path.resolve(process.cwd(), envRoot);
  }
  // Default: parent directory of web/
  return path.resolve(process.cwd(), "..");
}

export function getRunsDir(): string {
  return path.join(getProjectRoot(), "runs");
}

export function getRunDir(runId: string): string {
  return path.join(getRunsDir(), runId);
}

export function getOrchestratorPath(): string {
  return path.join(getProjectRoot(), "orchestrator.sh");
}

export function getLearningsPath(): string {
  return path.join(getProjectRoot(), "learnings.json");
}

function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readWebMeta(runDir: string): WebRunMeta | null {
  const metaPath = path.join(runDir, "web-run-meta.json");
  try {
    const content = fs.readFileSync(metaPath, "utf-8");
    return JSON.parse(content) as WebRunMeta;
  } catch {
    return null;
  }
}

export function getRunStatus(runId: string, logContent: string, webMeta: WebRunMeta | null, activeRunId: string | string[] | null): RunStatus {
  // If it's one of the currently active runs
  if (activeRunId) {
    const activeIds = Array.isArray(activeRunId) ? activeRunId : [activeRunId];
    if (activeIds.includes(runId)) return "running";
  }

  // If web meta says it's running, check if process is still alive
  if (webMeta?.status === "running" && webMeta.pid) {
    try {
      process.kill(webMeta.pid, 0); // Signal 0 checks if process exists
      return "running";
    } catch {
      // Process is dead — it's stopped
      return "stopped";
    }
  }

  if (webMeta?.status === "stopped") return "stopped";

  // Parse log to determine status
  const parsed = parseLogContent(logContent);

  if (parsed.isComplete) {
    return parsed.buildSuccess ? "completed" : "failed";
  }

  // If there's log content but pipeline isn't complete and not running
  if (logContent.trim().length > 0) {
    return "stopped";
  }

  return "queued";
}

export function listRuns(activeRunId: string | string[] | null): PipelineRun[] {
  const runsDir = getRunsDir();

  if (!fs.existsSync(runsDir)) {
    return [];
  }

  const entries = fs.readdirSync(runsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .sort((a, b) => b.name.localeCompare(a.name)); // newest first

  return entries.map((entry) => {
    const runDir = path.join(runsDir, entry.name);
    const logPath = path.join(runDir, "pipeline.log");
    const logContent = readFileSafe(logPath);
    const webMeta = readWebMeta(runDir);
    const parsed = parseLogContent(logContent);
    const status = getRunStatus(entry.name, logContent, webMeta, activeRunId);

    // Try to extract app name from product-spec.md
    let appName: string | undefined;
    const specPath = path.join(runDir, "product-spec.md");
    if (fileExists(specPath)) {
      const specContent = readFileSafe(specPath);
      const titleMatch = specContent.match(/^#\s+(.+)/m);
      if (titleMatch) {
        appName = titleMatch[1].trim();
      }
    }

    const run: PipelineRun = {
      id: entry.name,
      category: extractCategoryFromRunId(entry.name),
      timestamp: extractTimestampFromRunId(entry.name),
      startedAt: parsed.startedAt || webMeta?.startedAt || "",
      completedAt: parsed.completedAt || webMeta?.completedAt,
      status,
      buildSuccess: parsed.buildSuccess,
      currentStep: parsed.currentStep,
      steps: parsed.steps,
      totalCostUsd: parsed.totalCostUsd,
      workspace: runDir,
      hasProductSpec: fileExists(specPath),
      hasReviewReport: fileExists(path.join(runDir, "review-report.md")),
      appName,
    };

    return run;
  });
}

export function getRunDetail(runId: string, activeRunId: string | string[] | null): PipelineRun | null {
  const runDir = getRunDir(runId);
  if (!fs.existsSync(runDir)) return null;

  const runs = listRuns(activeRunId);
  return runs.find((r) => r.id === runId) || null;
}

export function listArtifacts(runId: string): RunArtifact[] {
  const runDir = getRunDir(runId);
  if (!fs.existsSync(runDir)) return [];

  const artifacts: RunArtifact[] = [];

  function scan(dir: string, relativeTo: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(relativeTo, fullPath);

      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

      if (entry.isDirectory()) {
        artifacts.push({
          path: relPath,
          name: entry.name,
          type: "directory",
        });
        scan(fullPath, relativeTo);
      } else {
        const stat = fs.statSync(fullPath);
        artifacts.push({
          path: relPath,
          name: entry.name,
          type: "file",
          size: stat.size,
          extension: path.extname(entry.name).toLowerCase(),
        });
      }
    }
  }

  scan(runDir, runDir);
  return artifacts;
}

export function readLearnings(): Record<string, unknown> {
  const learningsPath = getLearningsPath();
  try {
    const content = fs.readFileSync(learningsPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}
