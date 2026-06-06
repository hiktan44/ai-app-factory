import { NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Resolve an API key: if the value from the client is masked (contains ●),
 * fall back to the real value stored in settings.json.
 */
function resolveKey(clientValue: string | undefined, settingsKey: string): string {
  if (clientValue && !clientValue.includes("●")) {
    return clientValue;
  }
  const stored = readSettings();
  return (stored as any)[settingsKey] as string || "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { service: string; settings: Record<string, string> };
    const { service, settings } = body;

    if (service === "anthropic") {
      const apiKey = resolveKey(settings.anthropicApiKey, "anthropicApiKey");
      if (!apiKey) {
        return NextResponse.json({ success: false, message: "Geçerli bir API key girin" });
      }
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 5,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (res.ok) return NextResponse.json({ success: true, message: "✅ Claude API bağlantısı başarılı!" });
      const err = await res.json() as { error?: { message?: string } };
      return NextResponse.json({ success: false, message: `Claude API hatası: ${err?.error?.message || res.status}` });
    }

    if (service === "gemini") {
      const apiKey = resolveKey(settings.geminiApiKey, "geminiApiKey");
      if (!apiKey) {
        return NextResponse.json({ success: false, message: "Geçerli bir API key girin" });
      }
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (res.ok) return NextResponse.json({ success: true, message: "✅ Gemini API bağlantısı başarılı!" });
      return NextResponse.json({ success: false, message: `Gemini API hatası: ${res.status}` });
    }

    if (service === "grok") {
      const apiKey = resolveKey(settings.grokApiKey, "grokApiKey");
      if (!apiKey) {
        return NextResponse.json({ success: false, message: "Geçerli bir API key girin" });
      }
      const res = await fetch("https://api.x.ai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) return NextResponse.json({ success: true, message: "✅ Grok API bağlantısı başarılı!" });
      return NextResponse.json({ success: false, message: `Grok API hatası: ${res.status}` });
    }

    if (service === "qwen") {
      const apiKey = resolveKey(settings.qwenApiKey, "qwenApiKey");
      if (!apiKey) {
        return NextResponse.json({ success: false, message: "Geçerli bir API key girin" });
      }
      const res = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) return NextResponse.json({ success: true, message: "✅ Qwen API bağlantısı başarılı!" });
      return NextResponse.json({ success: false, message: `Qwen API hatası: ${res.status}` });
    }

    if (service === "minimax") {
      const apiKey = resolveKey(settings.minimaxApiKey, "minimaxApiKey");
      if (!apiKey) {
        return NextResponse.json({ success: false, message: "Geçerli bir API key girin" });
      }
      // MiniMax test - minimal API call
      const res = await fetch("https://api.minimax.chat/v1/text/chatcompletion_v2", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "MiniMax-Text-01",
          max_tokens: 5,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (res.ok) return NextResponse.json({ success: true, message: "✅ MiniMax API bağlantısı başarılı!" });
      return NextResponse.json({ success: false, message: `MiniMax API hatası: ${res.status}` });
    }

    if (service === "openrouter") {
      const apiKey = resolveKey(settings.openrouterApiKey, "openrouterApiKey");
      if (!apiKey) {
        return NextResponse.json({ success: false, message: "Geçerli bir API key girin" });
      }
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) return NextResponse.json({ success: true, message: "✅ OpenRouter API bağlantısı başarılı!" });
      return NextResponse.json({ success: false, message: `OpenRouter API hatası: ${res.status}` });
    }

    if (service === "github") {
      const token = resolveKey(settings.githubToken, "githubToken");
      if (!token) {
        return NextResponse.json({ success: false, message: "Geçerli bir token girin" });
      }
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json() as { login: string };
        return NextResponse.json({ success: true, message: `✅ GitHub bağlantısı başarılı! Kullanıcı: ${user.login}` });
      }
      return NextResponse.json({ success: false, message: `GitHub hatası: ${res.status}` });
    }

    if (service === "coolify") {
      const coolifyApiUrl = settings.coolifyApiUrl || readSettings().coolifyApiUrl || "";
      const coolifyApiToken = resolveKey(settings.coolifyApiToken, "coolifyApiToken");
      if (!coolifyApiUrl || !coolifyApiToken) {
        return NextResponse.json({ success: false, message: "URL ve token girin" });
      }
      const res = await fetch(`${coolifyApiUrl}/api/v1/teams`, {
        headers: { Authorization: `Bearer ${coolifyApiToken}` },
      });
      if (res.ok) return NextResponse.json({ success: true, message: "✅ Coolify bağlantısı başarılı!" });
      return NextResponse.json({ success: false, message: `Coolify hatası: ${res.status}` });
    }

    return NextResponse.json({ success: false, message: "Bilinmeyen servis" });
  } catch (error) {
    console.error("Settings test error:", error);
    return NextResponse.json({ success: false, message: "Bağlantı testi başarısız" });
  }
}
