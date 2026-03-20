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
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
        ? process.env.ANTHROPIC_API_KEY.slice(0, 12) + "..."
        : "NOT SET",
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "SET" : "NOT SET",
    },
  };

  // Test claude CLI with API key (gosu ile factory kullanıcısı olarak)
  try {
    const isRoot = process.getuid?.() === 0;
    const hasGosu = (() => { try { execSync("command -v gosu", { timeout: 2000 }); return true; } catch { return false; } })();

    let cmd: string;
    if (isRoot && hasGosu) {
      cmd = `HOME=/home/factory ANTHROPIC_API_KEY="${process.env.ANTHROPIC_API_KEY || ""}" gosu factory claude -p "say: ok" --dangerously-skip-permissions --output-format json --max-turns 1 2>&1 | head -c 500`;
    } else {
      cmd = `ANTHROPIC_API_KEY="${process.env.ANTHROPIC_API_KEY || ""}" claude -p "say: ok" --dangerously-skip-permissions --output-format json --max-turns 1 2>&1 | head -c 500`;
    }

    const testResult = execSync(cmd, { timeout: 60000, shell: "/bin/bash" }).toString().trim();
    info.claudeTest = testResult;
    info.claudeTestMethod = isRoot && hasGosu ? "gosu factory" : "direct";
  } catch (e) {
    const errMsg = String(e);
    info.claudeTest = "ERROR: " + errMsg.slice(0, 500);
    // stdout içindeki çıktıyı da yakala
    if ((e as { stdout?: Buffer }).stdout) {
      info.claudeTestStdout = (e as { stdout: Buffer }).stdout.toString().slice(0, 500);
    }
  }

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

  // Volume ve runs dizini durumu
  try {
    const factoryStats = fs.statSync("/factory");
    info.factoryVolume = {
      exists: true,
      isMount: true, // Docker volume mount
      dev: factoryStats.dev,
    };
    if (fs.existsSync("/factory/runs")) {
      const runsEntries = fs.readdirSync("/factory/runs");
      info.runsCount = runsEntries.length;
      info.runsList = runsEntries.sort().reverse().slice(0, 10);
    } else {
      info.runsCount = 0;
      info.runsError = "/factory/runs does not exist";
    }
  } catch (e) {
    info.factoryVolumeError = String(e).slice(0, 200);
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
