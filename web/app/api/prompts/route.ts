import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getProjectRoot } from "@/lib/file-utils";

export const dynamic = "force-dynamic";

const PROMPT_NAMES = [
  "discover",
  "architecture",
  "build",
  "verify_fix",
  "review",
  "assets",
  "marketing",
  "screenshots",
  "package",
  "update_learnings",
];

const PROMPT_LABELS: Record<string, { label: string; description: string; llm: string }> = {
  discover: { label: "1. Keşif & Fikir", description: "Pazar araştırması ve fikir üretimi", llm: "Gemini/Grok" },
  architecture: { label: "2. Mimari Tasarım", description: "Uygulama mimarisi ve teknik spec", llm: "Claude" },
  build: { label: "3. Kod Yazma", description: "Uygulama kodunun üretimi", llm: "Claude" },
  verify_fix: { label: "4. Doğrulama & Düzeltme", description: "Build hataları ve düzeltmeler", llm: "Claude" },
  review: { label: "5. Kod Review", description: "Kalite kontrolü ve iyileştirme", llm: "Gemini" },
  assets: { label: "6. Asset Üretimi", description: "SVG ikonlar ve görseller", llm: "Gemini" },
  marketing: { label: "7. Marketing", description: "EN/TR pazarlama metinleri", llm: "Qwen/Gemini" },
  screenshots: { label: "8. Ekran Görüntüleri", description: "UI screenshot üretimi", llm: "Gemini" },
  package: { label: "9. Paketleme", description: "Docker ve deploy konfigürasyonu", llm: "Gemini" },
  update_learnings: { label: "10. Öğrenme Güncelleme", description: "learnings.json güncelleme", llm: "Gemini" },
};

function getPromptsDir(): string {
  return path.join(getProjectRoot(), "prompts");
}

export async function GET() {
  const promptsDir = getPromptsDir();
  const prompts: Record<string, { content: string; label: string; description: string; llm: string }> = {};

  for (const name of PROMPT_NAMES) {
    const filePath = path.join(promptsDir, `${name}.md`);
    try {
      const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
      prompts[name] = {
        content,
        ...(PROMPT_LABELS[name] || { label: name, description: "", llm: "Claude" }),
      };
    } catch {
      prompts[name] = {
        content: "",
        ...(PROMPT_LABELS[name] || { label: name, description: "", llm: "Claude" }),
      };
    }
  }

  return NextResponse.json(prompts);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name: string; content: string };
    const { name, content } = body;

    if (!name || !PROMPT_NAMES.includes(name)) {
      return NextResponse.json({ error: "Geçersiz prompt adı" }, { status: 400 });
    }

    const promptsDir = getPromptsDir();
    const filePath = path.join(promptsDir, `${name}.md`);
    fs.writeFileSync(filePath, content, "utf-8");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Prompt save error:", error);
    return NextResponse.json({ error: "Prompt kaydedilemedi" }, { status: 500 });
  }
}
