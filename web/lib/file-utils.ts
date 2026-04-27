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

interface DeployInfo {
      deployStatus?: "not_started" | "deploying" | "deployed" | "failed";
      deployUrl?: string;
      githubRepoUrl?: string;
}

function normalizeUrl(u: string | undefined): string | undefined {
      if (!u) return undefined;
      const trimmed = u.trim();
      if (!trimmed) return undefined;
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return `https://${trimmed}`;
}

/**
 * Read deploy artifacts and derive normalized DeployInfo for the run.
 *
 * Looks at (in order):
 *   1) deploy/deploy-result.json   - written by /api/runs/[id]/deploy and /api/runs/[id]/run
 *   2) deploy/coolify-app-fqdn.txt - written by orchestrator.sh when present
 *   3) deploy/github-repo-url.txt  - written by orchestrator.sh after GitHub push
 *
 * Used by listRuns() and getRunDetail() so the UI can show "Canli Site" /
 * "Uygulamayi Calistir" buttons consistently for ALL runs (existing and future),
 * regardless of which deploy target was used.
 */
function readDeployInfo(runDir: string): DeployInfo {
      const deployDir = path.join(runDir, "deploy");
      if (!fs.existsSync(deployDir)) return {};

  const result: DeployInfo = {};

  const resultPath = path.join(deployDir, "deploy-result.json");
      if (fs.existsSync(resultPath)) {
              try {
                        const data = JSON.parse(fs.readFileSync(resultPath, "utf-8")) as Record<string, unknown>;
                        const url = normalizeUrl(
                                    (data.deploymentUrl as string | undefined) ||
                                      (data.url as string | undefined) ||
                                      (data.deployUrl as string | undefined),
                                  );
                        const success = data.success === true;
                        result.deployUrl = url;
                        result.githubRepoUrl = data.githubRepoUrl as string | undefined;
                        result.deployStatus = success && url ? "deployed" : url ? "deployed" : "failed";
              } catch {
                        // ignore parse errors and try fallbacks below
              }
      }

  if (!result.deployUrl) {
          const fqdnPath = path.join(deployDir, "coolify-app-fqdn.txt");
          if (fs.existsSync(fqdnPath)) {
                    const fqdn = readFileSafe(fqdnPath).trim();
                    if (fqdn) {
                                result.deployUrl = normalizeUrl(fqdn);
                                result.deployStatus = "deployed";
                    }
          }
  }

  if (!result.githubRepoUrl) {
          const ghPath = path.join(deployDir, "github-repo-url.txt");
          if (fs.existsSync(ghPath)) {
                    const gh = readFileSafe(ghPath).trim();
                    if (gh) result.githubRepoUrl = gh;
          }
  }

  if (!result.deployUrl && result.githubRepoUrl && !result.deployStatus) {
          result.deployStatus = "deploying";
  }

  return result;
}

export function getRunStatus(runId: string, logContent: string, webMeta: WebRunMeta | null, activeRunId: string | string[] | null): RunStatus {
      if (activeRunId) {
              const activeIds = Array.isArray(activeRunId) ? activeRunId : [activeRunId];
              if (activeIds.includes(runId)) return "running";
      }

  if (webMeta?.status === "running" && webMeta.pid) {
          try {
                    process.kill(webMeta.pid, 0);
                    return "running";
          } catch {
                    // process gone
          }
  }

  const parsed = parseLogContent(logContent);

  if (parsed.isComplete) {
          if (parsed.buildSuccess === false) {
                    return "failed";
          }
          return "completed";
  }

  if (logContent.trim().length > 0) {
          const runDir = getRunDir(runId);
          try {
                    const buildStatusPath = path.join(runDir, "build-status.txt");
                    if (fs.existsSync(buildStatusPath)) {
                                const buildStatus = fs.readFileSync(buildStatusPath, "utf-8").trim();
                                if (buildStatus === "BUILD_SUCCESS") {
                                              return "completed";
                                }
                    }
          } catch {
                    // ignore
          }
  }

  if (webMeta?.status === "stopped" || webMeta?.status === "failed") {
          return "stopped";
  }

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
        .sort((a, b) => b.name.localeCompare(a.name));

  return entries.map((entry) => {
          const runDir = path.join(runsDir, entry.name);
          const logPath = path.join(runDir, "pipeline.log");
          const logContent = readFileSafe(logPath);
          const webMeta = readWebMeta(runDir);
          const parsed = parseLogContent(logContent);
          const status = getRunStatus(entry.name, logContent, webMeta, activeRunId);
          const deployInfo = readDeployInfo(runDir);

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
                                   deployStatus: deployInfo.deployStatus,
                                   deployUrl: deployInfo.deployUrl,
                                   githubRepoUrl: deployInfo.githubRepoUrl,
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
