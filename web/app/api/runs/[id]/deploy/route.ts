import { NextResponse } from "next/server";
import { getRunDir } from "@/lib/file-utils";
import { readSettings } from "@/lib/settings";
import { deployGeneratedApp } from "@/lib/coolify-deployer";
import fs from "fs";
import path from "path";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const runDir = getRunDir(id);
    const appDir = path.join(runDir, "app");

    if (!fs.existsSync(appDir)) {
      return NextResponse.json(
        { error: "App dizini bulunamadı — pipeline tamamlanmamış olabilir" },
        { status: 404 },
      );
    }

    const settings = readSettings();
    if (!settings.coolifyApiUrl || !settings.coolifyApiToken) {
      return NextResponse.json(
        { error: "Coolify API credentials ayarlanmamış. /settings sayfasından ekleyin." },
        { status: 400 },
      );
    }

    if (!settings.githubToken) {
      return NextResponse.json(
        { error: "GitHub token ayarlanmamış. /settings sayfasından ekleyin." },
        { status: 400 },
      );
    }

    // Extract app name from product-spec.md
    let appName = id;
    const specPath = path.join(runDir, "product-spec.md");
    if (fs.existsSync(specPath)) {
      const spec = fs.readFileSync(specPath, "utf-8");
      const match = spec.match(/^#\s+(.+)/m);
      if (match) appName = match[1].trim();
    }

    const result = await deployGeneratedApp({
      appName,
      runId: id,
      appDir,
    });

    // Save deploy result to run directory
    const deployDir = path.join(runDir, "deploy");
    if (!fs.existsSync(deployDir)) {
      fs.mkdirSync(deployDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(deployDir, "deploy-result.json"),
      JSON.stringify(result, null, 2),
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Deploy failed:", error);
    return NextResponse.json(
      { error: "Deploy başarısız oldu", details: String(error) },
      { status: 500 },
    );
  }
}
