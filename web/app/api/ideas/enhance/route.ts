import { NextResponse } from "next/server";
import { researchIdea, enhanceIdeaWithLLM } from "@/lib/idea-researcher";
import { readSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { idea: string; category: string };
    const { idea, category } = body;

    if (!idea || !category) {
      return NextResponse.json({ error: "idea ve category gerekli" }, { status: 400 });
    }

    // Ayarları oku
    const settings = readSettings();

    // Önce araştır
    const research = await researchIdea(idea, category);

    // Hangi LLM kullanılacak?
    const geminiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY || "";
    const claudeKey = settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY || "";

    const provider = geminiKey ? "gemini" : "claude";
    const apiKey = provider === "gemini" ? geminiKey : claudeKey;

    if (!apiKey) {
      return NextResponse.json({ error: "LLM API key bulunamadı. Ayarlardan ekleyin." }, { status: 400 });
    }

    // Fikri geliştir
    const enhanced = await enhanceIdeaWithLLM(idea, category, research, apiKey, provider);

    return NextResponse.json({ enhanced, research });
  } catch (error) {
    console.error("Enhance error:", error);
    return NextResponse.json({ error: "Fikir geliştirme başarısız" }, { status: 500 });
  }
}
