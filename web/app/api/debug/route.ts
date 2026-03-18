import { NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import { getProjectRoot, getOrchestratorPath } from "@/lib/file-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const projectRoot = getProjectRoot();
  const orchestratorPath = getOrchestratorPath();

  const info: Record<string, unknown> = {
    cwd: process.cwd(),
    projectRoot,
    orchestratorPath,
    orchestratorExists: fs.existsSync(orchestratorPath),
    factoryContents: [] as string[],
    env: {
      PROJECT_ROOT: process.env.PROJECT_ROOT,
      PATH: process.env.PATH,
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  // List /factory contents
  try {
    info.factoryContents = fs.readdirSync("/factory");
  } catch {
    info.factoryContents = ["ERROR: /factory not readable"];
  }

  // Check which binaries available
  try {
    info.claudeVersion = execSync("claude --version 2>&1", { timeout: 5000 }).toString().trim();
  } catch {
    info.claudeVersion = "not found";
  }

  try {
    info.bashVersion = execSync("bash --version 2>&1 | head -1", { timeout: 3000 }).toString().trim();
  } catch {
    info.bashVersion = "not found";
  }

  // Check stdout log of last run
  try {
    const runsDir = "/factory/runs";
    if (fs.existsSync(runsDir)) {
      const runs = fs.readdirSync(runsDir).sort().reverse().slice(0, 3);
      info.recentRuns = runs.map((r) => {
        const dir = `${runsDir}/${r}`;
        const files = fs.readdirSync(dir);
        const stdoutLog = files.includes("web-stdout.log")
          ? fs.readFileSync(`${dir}/web-stdout.log`, "utf-8").slice(-500)
          : null;
        const stderrLog = files.includes("web-stderr.log")
          ? fs.readFileSync(`${dir}/web-stderr.log`, "utf-8").slice(-500)
          : null;
        return { run: r, files, stdoutLog, stderrLog };
      });
    }
  } catch (e) {
    info.recentRunsError = String(e);
  }

  return NextResponse.json(info, { status: 200 });
}
