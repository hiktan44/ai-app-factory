import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { service, settings } = await request.json();

    if (service === "gemini") {
      const apiKey = settings.geminiApiKey;
      if (!apiKey || apiKey.includes("●")) {
        return NextResponse.json({ success: false, message: "Geçerli bir API key girin" });
      }
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (res.ok) {
        return NextResponse.json({ success: true, message: "Gemini API bağlantısı başarılı!" });
      }
      return NextResponse.json({ success: false, message: `Gemini API hatası: ${res.status}` });
    }

    if (service === "github") {
      const token = settings.githubToken;
      if (!token || token.includes("●")) {
        return NextResponse.json({ success: false, message: "Geçerli bir token girin" });
      }
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        return NextResponse.json({
          success: true,
          message: `GitHub bağlantısı başarılı! Kullanıcı: ${user.login}`,
        });
      }
      return NextResponse.json({ success: false, message: `GitHub hatası: ${res.status}` });
    }

    if (service === "coolify") {
      const { coolifyApiUrl, coolifyApiToken } = settings;
      if (!coolifyApiUrl || !coolifyApiToken || coolifyApiToken.includes("●")) {
        return NextResponse.json({ success: false, message: "URL ve token girin" });
      }
      const res = await fetch(`${coolifyApiUrl}/api/v1/teams`, {
        headers: { Authorization: `Bearer ${coolifyApiToken}` },
      });
      if (res.ok) {
        return NextResponse.json({ success: true, message: "Coolify bağlantısı başarılı!" });
      }
      return NextResponse.json({ success: false, message: `Coolify hatası: ${res.status}` });
    }

    return NextResponse.json({ success: false, message: "Bilinmeyen servis" });
  } catch (error) {
    console.error("Settings test error:", error);
    return NextResponse.json({ success: false, message: "Bağlantı testi başarısız" });
  }
}
