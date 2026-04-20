import { NextResponse } from "next/server";
import { getRunDir } from "@/lib/file-utils";
import { readSettings } from "@/lib/settings";
import fs from "fs";
import path from "path";

export const maxDuration = 120;

interface FixRequest {
  issue: string;
  filePath?: string;
  action: "analyze" | "fix" | "run-dev";
}

// Collect key files from the app directory for context
function collectAppContext(appDir: string, maxFiles = 15): string {
  const files: { path: string; content: string }[] = [];
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".css"];
  const ignore = ["node_modules", ".next", "dist", ".git"];

  function walk(dir: string, prefix = "") {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (ignore.includes(entry.name)) continue;
      if (files.length >= maxFiles) break;
      const fullPath = path.join(dir, entry.name);
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.length < 10000) {
            files.push({ path: relPath, content });
          }
        } catch {
          /* skip unreadable */
        }
      }
    }
  }

  walk(appDir);
  return files
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as FixRequest;
  const { issue, filePath, action } = body;

  try {
    const runDir = getRunDir(id);
    const appDir = path.join(runDir, "app");
    const settings = readSettings();

    // --- ACTION: run-dev — start the app locally ---
    if (action === "run-dev") {
      const result = await startDevServer(appDir);
      return NextResponse.json(result);
    }

    // --- ACTION: analyze or fix ---
    // Gather context
    const logPath = path.join(runDir, "pipeline.log");
    const pipelineLog = fs.existsSync(logPath)
      ? fs.readFileSync(logPath, "utf-8").split("\n").slice(-80).join("\n")
      : "Log bulunamadı";

    const buildStatusPath = path.join(runDir, "build-status.txt");
    const buildStatus = fs.existsSync(buildStatusPath)
      ? fs.readFileSync(buildStatusPath, "utf-8").trim()
      : "UNKNOWN";

    const reviewPath = path.join(runDir, "review-report.md");
    const reviewReport = fs.existsSync(reviewPath)
      ? fs.readFileSync(reviewPath, "utf-8").slice(0, 3000)
      : "";

    // Specific file content if requested
    let specificFile = "";
    if (filePath) {
      const fullPath = path.join(runDir, filePath);
      if (fullPath.startsWith(runDir) && fs.existsSync(fullPath)) {
        specificFile = fs.readFileSync(fullPath, "utf-8");
      }
    }

    // App context (key source files)
    const appContext = fs.existsSync(appDir)
      ? collectAppContext(appDir)
      : "App dizini bulunamadı";

    // Determine which API to use
    const apiKey = settings.anthropicApiKey || settings.claudeOauthToken;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Anthropic API key veya Claude OAuth token ayarlanmamış. /settings sayfasından ekleyin." },
        { status: 400 },
      );
    }

    const isOAuth = !settings.anthropicApiKey && !!settings.claudeOauthToken;

    const systemPrompt = `Sen bir Next.js 15 + Supabase + Tailwind CSS v4 uzmanısın.
Kullanıcı üretilen bir uygulamanın sorunlarını bildiriyor. Görevin:

1. Sorunu analiz et
2. Kök nedeni bul
3. ${action === "fix" ? "Düzeltilmiş dosyaları ÜRETip JSON formatında döndür" : "Çözüm adımlarını listele"}

Build Durumu: ${buildStatus}

${action === "fix" ? `
RESPONSE FORMAT (strictly JSON):
{
  "analysis": "Sorunun kök nedeni açıklaması",
  "fixes": [
    {
      "filePath": "app/relative/path.tsx",
      "content": "Düzeltilmiş tam dosya içeriği",
      "description": "Bu dosyada ne değişti"
    }
  ],
  "commands": ["çalıştırılması gereken terminal komutları (opsiyonel)"]
}` : `
Markdown formatında analiz raporu döndür:
## Sorun Analizi
## Kök Neden
## Çözüm Adımları
## Düzeltilecek Dosyalar`}`;

    const userMessage = `KULLANICI SORUNU:
${issue}

${specificFile ? `SORUNLU DOSYA (${filePath}):\n\`\`\`\n${specificFile}\n\`\`\`` : ""}

PIPELINE LOG (son 80 satır):
\`\`\`
${pipelineLog}
\`\`\`

${reviewReport ? `CODE REVIEW RAPORU:\n${reviewReport}\n` : ""}

UYGULAMA KAYNAK KODLARI:
${appContext}`;

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (isOAuth) {
      headers["Authorization"] = `Bearer ${settings.claudeOauthToken}`;
    } else {
      headers["x-api-key"] = settings.anthropicApiKey;
    }
    headers["anthropic-version"] = "2023-06-01";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", errorText);
      return NextResponse.json(
        { error: `Claude API hatası: ${response.status}`, details: errorText },
        { status: 502 },
      );
    }

    const data = await response.json();
    const assistantText = data.content?.[0]?.text || "";

    // If fix action, try to apply fixes
    if (action === "fix") {
      try {
        // Extract JSON from response (might be wrapped in markdown code blocks)
        const jsonMatch = assistantText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const fixData = JSON.parse(jsonMatch[0]);

          // Apply fixes to files
          const appliedFixes: string[] = [];
          if (fixData.fixes && Array.isArray(fixData.fixes)) {
            for (const fix of fixData.fixes) {
              const targetPath = path.join(appDir, fix.filePath);
              // Security: ensure within appDir
              if (!targetPath.startsWith(appDir)) continue;
              // Create directory if needed
              const dir = path.dirname(targetPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              fs.writeFileSync(targetPath, fix.content);
              appliedFixes.push(`✅ ${fix.filePath}: ${fix.description}`);
            }
          }

          return NextResponse.json({
            success: true,
            action: "fix",
            analysis: fixData.analysis || "",
            appliedFixes,
            commands: fixData.commands || [],
            rawResponse: assistantText,
          });
        }
      } catch (parseErr) {
        // JSON parse failed — return raw analysis
        console.error("Fix JSON parse failed:", parseErr);
      }
    }

    return NextResponse.json({
      success: true,
      action: "analyze",
      analysis: assistantText,
    });
  } catch (error) {
    console.error("Debug/fix failed:", error);
    return NextResponse.json(
      { error: "Debug/fix işlemi başarısız", details: String(error) },
      { status: 500 },
    );
  }
}

async function startDevServer(appDir: string): Promise<Record<string, unknown>> {
  if (!fs.existsSync(appDir)) {
    return { error: "App dizini bulunamadı", success: false };
  }

  // Check if package.json exists
  const pkgPath = path.join(appDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return { error: "package.json bulunamadı", success: false };
  }

  // Check if node_modules exists
  const nodeModules = path.join(appDir, "node_modules");
  const needsInstall = !fs.existsSync(nodeModules);

  return {
    success: true,
    appDir,
    needsInstall,
    instructions: needsInstall
      ? `cd ${appDir} && pnpm install && pnpm dev`
      : `cd ${appDir} && pnpm dev`,
    message: needsInstall
      ? "Önce bağımlılıklar yüklenmeli, sonra dev server başlatılacak"
      : "Dev server başlatılabilir",
  };
}
