import fs from "fs";
import path from "path";
import { getProjectRoot } from "./file-utils";

export interface AppSettings {
  // LLM Keys
  claudeOauthToken: string; // Max Plan OAuth token (öncelikli)
  anthropicApiKey: string;
  geminiApiKey: string;
  grokApiKey: string;
  qwenApiKey: string;
  minimaxApiKey: string;
  openrouterApiKey: string;
  // Git & Deploy
  githubToken: string;
  githubOrg: string;
  // Vercel (primary deploy target)
  vercelToken: string;
  vercelTeamId: string;
  // Coolify (secondary/self-hosted)
  coolifyApiUrl: string;
  coolifyApiToken: string;
  coolifyServerUuid: string;
  coolifyProjectUuid: string;
  coolifyDestinationUuid: string;
  // Pipeline
  maxTurns: number;
  maxConcurrentRuns: number;
}

export function getSettingsPath(): string {
  return path.join(getProjectRoot(), "settings.json");
}

export function readSettings(): AppSettings {
  const settingsPath = getSettingsPath();
  let data: Partial<AppSettings> = {};
  try {
    if (fs.existsSync(settingsPath)) {
      data = JSON.parse(fs.readFileSync(settingsPath, "utf-8")) as Partial<AppSettings>;
    }
  } catch {
    /* ignore */
  }
  return {
    claudeOauthToken: data.claudeOauthToken || process.env.CLAUDE_CODE_OAUTH_TOKEN || "",
    anthropicApiKey: data.anthropicApiKey || process.env.ANTHROPIC_API_KEY || "",
    geminiApiKey: data.geminiApiKey || process.env.GEMINI_API_KEY || "",
    grokApiKey: data.grokApiKey || process.env.GROK_API_KEY || "",
    qwenApiKey: data.qwenApiKey || process.env.QWEN_API_KEY || "",
    minimaxApiKey: data.minimaxApiKey || process.env.MINIMAX_API_KEY || "",
    openrouterApiKey: data.openrouterApiKey || process.env.OPENROUTER_API_KEY || "",
    githubToken: data.githubToken || process.env.GITHUB_TOKEN || "",
    githubOrg: data.githubOrg || process.env.GITHUB_ORG || "",
    vercelToken: data.vercelToken || process.env.VERCEL_TOKEN || "",
    vercelTeamId: data.vercelTeamId || process.env.VERCEL_TEAM_ID || "",
    coolifyApiUrl: data.coolifyApiUrl || process.env.COOLIFY_API_URL || "",
    coolifyApiToken: data.coolifyApiToken || process.env.COOLIFY_API_TOKEN || "",
    coolifyServerUuid: data.coolifyServerUuid || process.env.COOLIFY_SERVER_UUID || "",
    coolifyProjectUuid: data.coolifyProjectUuid || process.env.COOLIFY_PROJECT_UUID || "",
    coolifyDestinationUuid: data.coolifyDestinationUuid || process.env.COOLIFY_DESTINATION_UUID || "",
    maxTurns: data.maxTurns || (process.env.MAX_TURNS ? parseInt(process.env.MAX_TURNS, 10) : 50),
    maxConcurrentRuns: data.maxConcurrentRuns || 1,
  };
}

export function writeSettings(settings: Partial<AppSettings>): void {
  const settingsPath = getSettingsPath();
  const existing = readSettings();
  const updated = { ...existing, ...settings };
  fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2));
}

export function maskValue(value: string): string {
  if (!value || value.length < 8) return value ? "●●●●●●●●" : "";
  return value.substring(0, 4) + "●".repeat(value.length - 8) + value.substring(value.length - 4);
}
