import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getProjectRoot } from "@/lib/file-utils";

export const dynamic = "force-dynamic";

function getSettingsPath(): string {
  return path.join(getProjectRoot(), "settings.json");
}

function readSettings(): Record<string, string> {
  const settingsPath = getSettingsPath();
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

function maskValue(value: string): string {
  if (!value || value.length < 8) return value ? "●●●●●●●●" : "";
  return value.substring(0, 4) + "●".repeat(value.length - 8) + value.substring(value.length - 4);
}

export async function GET() {
  const settings = readSettings();
  // Return masked values
  return NextResponse.json({
    geminiApiKey: maskValue(settings.geminiApiKey || ""),
    githubToken: maskValue(settings.githubToken || ""),
    githubOrg: settings.githubOrg || "",
    coolifyApiUrl: settings.coolifyApiUrl || "",
    coolifyApiToken: maskValue(settings.coolifyApiToken || ""),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const settingsPath = getSettingsPath();
    const existing = readSettings();

    // Only update non-masked values
    const updated: Record<string, string> = { ...existing };

    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string" && !value.includes("●")) {
        updated[key] = value;
      }
    }

    fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2));

    // Also update .env.local for the web app
    const envPath = path.join(process.cwd(), ".env.local");
    const envContent = [
      `GEMINI_API_KEY=${updated.geminiApiKey || ""}`,
      `GITHUB_TOKEN=${updated.githubToken || ""}`,
      `GITHUB_ORG=${updated.githubOrg || ""}`,
      `COOLIFY_API_URL=${updated.coolifyApiUrl || ""}`,
      `COOLIFY_API_TOKEN=${updated.coolifyApiToken || ""}`,
    ].join("\n");

    fs.writeFileSync(envPath, envContent);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings save error:", error);
    return NextResponse.json({ error: "Ayarlar kaydedilemedi" }, { status: 500 });
  }
}
