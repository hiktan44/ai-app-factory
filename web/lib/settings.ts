import fs from "fs";
import path from "path";
import { getProjectRoot } from "./file-utils";

export interface AppSettings {
  // LLM Keys
  anthropicApiKey: string;
  geminiApiKey: string;
  grokApiKey: string;
  qwenApiKey: string;
  minimaxApiKey: string;
  openrouterApiKey: string;
  // Git & Deploy
  githubToken: string;
  githubOrg: string;
  coolifyApiUrl: string;
  coolifyApiToken: string;
  coolifyServerUuid: string;
  coolifyProjectUuid: string;
  // Pipeline
  maxTurns: number;
  maxConcurrentRuns: number;
}

export function getSettingsPath(): string {
  return path.join(getProjectRoot(), "settings.json");
}

export function readSettings(): AppSettings {
  const settingsPath = getSettingsPath();
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, "utf-8")) as AppSettings;
    }
  } catch {
    /* ignore */
  }
  return {
    anthropicApiKey: "",
    geminiApiKey: "",
    grokApiKey: "",
    qwenApiKey: "",
    minimaxApiKey: "",
    openrouterApiKey: "",
    githubToken: "",
    githubOrg: "",
    coolifyApiUrl: "",
    coolifyApiToken: "",
    coolifyServerUuid: "",
    coolifyProjectUuid: "",
    maxTurns: 50,
    maxConcurrentRuns: 1,
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
