import { NextResponse } from "next/server";
import { getRunDir } from "@/lib/file-utils";
import { readSettings } from "@/lib/settings";
import { deployToVercel } from "@/lib/vercel-deployer";
import { deployGeneratedApp } from "@/lib/coolify-deployer";
import fs from "fs";
import path from "path";

export async function POST(
  request: Request,
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

    // Determine deploy target: vercel > coolify > github-only
    const url = new URL(request.url);
    const targetParam = url.searchParams.get("target");
    const vercelToken = process.env.VERCEL_TOKEN || settings.vercelToken || "";
    const hasCoolify = !!(settings.coolifyApiUrl && settings.coolifyApiToken);

    // Auto-detect target if not specified
    const target = targetParam || (vercelToken ? "vercel" : hasCoolify ? "coolify" : "github");

    let result;

    if (target === "vercel" && vercelToken) {
      // Vercel deploy (primary)
      result = await deployToVercel({ appName, runId: id, appDir });
    } else if (target === "coolify" && hasCoolify) {
      // Coolify deploy (secondary)
      result = await deployGeneratedApp({ appName, runId: id, appDir });
    } else {
      // GitHub-only: just push code, no hosting
      result = await deployGeneratedApp({ appName, runId: id, appDir });
    }

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
