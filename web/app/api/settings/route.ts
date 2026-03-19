import { NextResponse } from "next/server";
import { readSettings, writeSettings, maskValue, type AppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = readSettings();
  // Return masked values
  return NextResponse.json({
    anthropicApiKey: maskValue(settings.anthropicApiKey || ""),
    geminiApiKey: maskValue(settings.geminiApiKey || ""),
    grokApiKey: maskValue(settings.grokApiKey || ""),
    qwenApiKey: maskValue(settings.qwenApiKey || ""),
    minimaxApiKey: maskValue(settings.minimaxApiKey || ""),
    openrouterApiKey: maskValue(settings.openrouterApiKey || ""),
    githubToken: maskValue(settings.githubToken || ""),
    githubOrg: settings.githubOrg || "",
    coolifyApiUrl: settings.coolifyApiUrl || "",
    coolifyApiToken: maskValue(settings.coolifyApiToken || ""),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<AppSettings>;
    const existing = readSettings();
    const updated: Partial<AppSettings> = { ...existing };

    // Only update non-masked values
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string" && !value.includes("●")) {
        (updated as Record<string, string>)[key] = value;
      }
    }

    writeSettings(updated as AppSettings);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings save error:", error);
    return NextResponse.json({ error: "Ayarlar kaydedilemedi" }, { status: 500 });
  }
}
