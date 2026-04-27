import { NextResponse } from "next/server";
import { getRunDir } from "@/lib/file-utils";
import { readSettings } from "@/lib/settings";
import { deployToVercel } from "@/lib/vercel-deployer";
import { deployGeneratedApp } from "@/lib/coolify-deployer";
import fs from "fs";
import path from "path";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface RunResult {
    success: boolean;
    url?: string;
    source?: "cached" | "fresh";
    target?: "vercel" | "coolify" | "github";
    githubRepoUrl?: string;
    message?: string;
    error?: string;
    details?: string;
  }

/**
 * POST /api/runs/[id]/run
 *
 * "Uygulamayi Calistir" / "Run app" endpoint.
 *
 * Strategy:
 *  - If a previous deploy result exists in deploy/deploy-result.json with a usable URL, return it (cached).
 *  - Otherwise, trigger a fresh deploy (Vercel preferred, Coolify fallback, GitHub-only as last resort)
 *    and persist the result so subsequent calls are instant.
 *
 * GET /api/runs/[id]/run also supported for convenience (idempotent read).
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const { id } = await params;
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    return runApp(id, force);
  }

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const { id } = await params;
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    return runApp(id, force);
  }

async function runApp(id: string, force: boolean): Promise<NextResponse<RunResult>> {
    try {
          const runDir = getRunDir(id);
          const appDir = path.join(runDir, "app");

          if (!fs.existsSync(appDir)) {
                  return NextResponse.json(
                            { success: false, error: "App dizini bulunamadi - pipeline tamamlanmamis olabilir" },
                            { status: 404 },
                          );
                }

          const deployDir = path.join(runDir, "deploy");
          const resultPath = path.join(deployDir, "deploy-result.json");

          // 1) Cached result?
          if (!force && fs.existsSync(resultPath)) {
                  try {
                            const cached = JSON.parse(fs.readFileSync(resultPath, "utf-8"));
                            const cachedUrl: string | undefined =
                              cached.deploymentUrl || cached.url || cached.deployUrl;
                            if (cached.success && cachedUrl) {
                                        return NextResponse.json({
                                                      success: true,
                                                      url: cachedUrl,
                                                      source: "cached",
                                                      target: cached.target,
                                                      githubRepoUrl: cached.githubRepoUrl,
                                                      message: "Mevcut deploy URL'i kullaniliyor",
                                                    });
                                      }
                          } catch {
                            // ignore parse errors, fall through to fresh deploy
                          }
                }

          // 2) Fresh deploy - try Vercel -> Coolify -> GitHub-only
          const settings = readSettings();
          if (!settings.githubToken) {
                  return NextResponse.json(
                            {
                                        success: false,
                                        error: "GitHub token ayarlanmamis. /settings sayfasindan ekleyin.",
                                      },
                            { status: 400 },
                          );
                }

          // Resolve app name
          let appName = id;
          const specPath = path.join(runDir, "product-spec.md");
          if (fs.existsSync(specPath)) {
                  const spec = fs.readFileSync(specPath, "utf-8");
                  const m = spec.match(/^#\s+(.+)/m);
                                             if (m) appName = m[1].trim();
                                           }

                                           const vercelToken = process.env.VERCEL_TOKEN || settings.vercelToken || "";
                                           const hasCoolify = !!(settings.coolifyApiUrl && settings.coolifyApiToken);

                                           let result: Record<string, unknown> = {};
                                           let target: "vercel" | "coolify" | "github" = "github";

                                           if (vercelToken) {
                                                   target = "vercel";
                                                   result = await deployToVercel({ appName, runId: id, appDir });
                                                 } else if (hasCoolify) {
                                                   target = "coolify";
                                                   result = await deployGeneratedApp({ appName, runId: id, appDir });
                                                 } else {
                                                   target = "github";
                                                   result = await deployGeneratedApp({ appName, runId: id, appDir });
                                                 }

                                           // Persist result
                                           if (!fs.existsSync(deployDir)) {
                                                   fs.mkdirSync(deployDir, { recursive: true });
                                                 }
                                           fs.writeFileSync(
                                                   resultPath,
                                                   JSON.stringify({ ...result, target, runAt: new Date().toISOString() }, null, 2),
                                                 );

                                           const deployedUrl =
                                             (result.deploymentUrl as string | undefined) ||
                                             (result.url as string | undefined) ||
                                             (result.deployUrl as string | undefined);

                                           if (result.success && deployedUrl) {
                                                   return NextResponse.json({
                                                             success: true,
                                                             url: deployedUrl,
                                                             source: "fresh",
                                                             target,
                                                             githubRepoUrl: result.githubRepoUrl as string | undefined,
                                                             message: "Uygulama deploy edildi",
                                                           });
                                                 }

                                           return NextResponse.json(
                                                   {
                                                             success: false,
                                                             target,
                                                             githubRepoUrl: result.githubRepoUrl as string | undefined,
                                                             error: (result.error as string) || "Deploy basarisiz oldu",
                                                             details: typeof result === "object" ? JSON.stringify(result).slice(0, 800) : undefined,
                                                           },
                                                   { status: 502 },
                                                 );
                                         } catch (error) {
                                               console.error("Run app failed:", error);
                                               return NextResponse.json(
                                                       { success: false, error: "Run app islemi basarisiz", details: String(error) },
                                                       { status: 500 },
                                                     );
                                             }
                                       }
                                       
