import type { IdeaProposal } from "./types";
import { readSettings } from "./settings";

// ============================================================
// Gemini Multi-Model Configuration
// ============================================================
// Pro  : Derin analiz, detayli dokuman uretimi, karmasik gorevler
// Flash: Hizli yaratici fikirler, hafif gorevler, JSON uretimi
// ============================================================

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Mevcut model katmanlari */
export type GeminiModelTier = "pro" | "flash";

/** Model tanimlari */
const MODELS: Record<GeminiModelTier, { id: string; label: string }> = {
  pro: {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro Preview",
  },
  flash: {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview",
  },
};

/** Gorev tipi -> model eslestirmesi */
type TaskType =
  | "idea-generation"       // Fikir uretimi (yaratici, hafif)
  | "product-spec"          // Urun dokumani (detayli, kritik)
  | "architecture"          // Mimari tasarim (karmasik)
  | "code-review"           // Kod inceleme (analitik)
  | "marketing"             // Pazarlama metni (yaratici, hafif)
  | "general";              // Genel amacli

/** Her gorev tipi icin hangi model kullanilacak */
const TASK_MODEL_MAP: Record<TaskType, GeminiModelTier> = {
  "idea-generation": "flash",    // Hizli yaratici beyin firtinasi
  "product-spec": "pro",         // Detayli teknik dokuman — Pro sart
  "architecture": "pro",         // Mimari kararlar — Pro sart
  "code-review": "pro",          // Derin kod analizi — Pro sart
  "marketing": "flash",          // Pazarlama metni — Flash yeterli
  "general": "flash",            // Genel gorevler — Flash yeterli
};

// ============================================================
// Yardimci fonksiyonlar
// ============================================================

function getApiKey(): string {
  // Önce settings.json'dan oku (ayarlar sayfasından kaydedilen değer)
  try {
    const settings = readSettings();
    if (settings.geminiApiKey && !settings.geminiApiKey.includes("●")) {
      return settings.geminiApiKey;
    }
  } catch { /* ignore */ }
  // Fallback: ortam değişkeni
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini API key ayarlanmamış. Lütfen /settings sayfasından ekleyin.");
  return key;
}

/** Gorev tipine gore model sec */
function selectModel(task: TaskType): { id: string; label: string; url: string } {
  const tier = TASK_MODEL_MAP[task];
  const model = MODELS[tier];
  return {
    ...model,
    url: `${GEMINI_BASE_URL}/${model.id}:generateContent`,
  };
}

/** Gemini API'ye istek gonder */
async function callGemini(opts: {
  task: TaskType;
  prompt: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
}): Promise<string> {
  const apiKey = getApiKey();
  const model = selectModel(opts.task);

  console.log(`[Gemini] Model: ${model.label} | Gorev: ${opts.task}`);

  const response = await fetch(`${model.url}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: opts.prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        topP: opts.topP ?? 0.9,
        maxOutputTokens: opts.maxOutputTokens ?? 4096,
        ...(opts.responseMimeType && { responseMimeType: opts.responseMimeType }),
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[Gemini] API error (${model.id}):`, errText);
    throw new Error(`Gemini API hatasi (${model.label}): ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(`Gemini API bos cevap dondu (${model.label})`);
  }

  return text;
}

// ============================================================
// Public API
// ============================================================

/** Hangi modelin hangi gorev icin kullanildigini dondurur (UI'da gostermek icin) */
export function getModelInfo(task: TaskType) {
  const tier = TASK_MODEL_MAP[task];
  const model = MODELS[tier];
  return { tier, model: model.id, label: model.label };
}

/** Tum model bilgilerini dondurur */
export function getAllModels() {
  return Object.entries(MODELS).map(([tier, model]) => ({
    tier: tier as GeminiModelTier,
    id: model.id,
    label: model.label,
    tasks: Object.entries(TASK_MODEL_MAP)
      .filter(([, t]) => t === tier)
      .map(([task]) => task),
  }));
}

/** Kategori icin SaaS uygulama fikri uret — trend verileriyle desteklenmis */
export async function generateIdea(category: string, trendContext?: string): Promise<IdeaProposal> {
  const seed = Math.random().toString(36).substring(2, 8);
  const angles = [
    "ProductHunt'ta basarili bir urunun clone'unu/gelistirilmis versiyonunu yap",
    "GitHub'da trend olan acik kaynak projenin managed SaaS versiyonunu yap",
    "ProductHunt gunluk top 5'teki bir urunun daha iyi alternatifini yap",
    "GitHub'da son 15 gunde en cok yildiz alan projeyi SaaS olarak paketle",
    "ProductHunt aylik top 15'ten birebir clone yap — kanıtlanmis talep",
    "GitHub trending projesinin hosted/managed versiyonunu yap (B2B SaaS)",
    "Basarili bir SaaS urunun daha ucuz/basit alternatifini yap",
    "Trend olan acik kaynak aracin UI-first cloud versiyonunu yap",
    "Popüler bir gelistirici aracinin no-code SaaS versiyonunu yap",
    "ProductHunt haftalik top 10'dan bir urunu farkli bir nis icin adapte et",
  ];
  const randomAngle = angles[Math.floor(Math.random() * angles.length)];

  const trendSection = trendContext
    ? `
═══════════════════════════════════════
GUNCEL TREND VERİLERİ (${new Date().toLocaleDateString("tr-TR")})
═══════════════════════════════════════

${trendContext}

═══════════════════════════════════════
`
    : "";

  const prompt = `Sen bir SaaS startup danismani ve urun stratejistisin. Gorevin: gercekte basarili olan uygulamalarin clone'larini veya gelistirilmis versiyonlarini onermek.

Kategori: ${category}
Oturum: ${seed}
Strateji: ${randomAngle}

${trendSection}

## KURALLAR

1. SADECE SaaS uygulamalar oner (subscription/freemium gelir modeli)
2. ProductHunt'ta gunluk top 5, haftalik top 10, aylik top 15'e girmis basarili urunlerin benzerlerini/clone'larini oner
3. GitHub'da son 15 gunde yildiz sayisi en fazla artan projelerin managed/hosted SaaS versiyonlarini oner
4. GitHub aylik top 10'daki projeleri SaaS olarak paketlenebilecek fikirler olarak deger
5. Onerdigin fikir GERCEK bir urune dayali olmali — "X'in clone'u" veya "Y'nin daha iyi versiyonu" seklinde belirt
6. Fikrin ilham aldigi kaynak urunu (ProductHunt veya GitHub projesi) ac acik belirt
7. Basit todo/note uygulamalari ONERME — gercek SaaS degerinde urunler oner
8. Her seferinde tamamen FARKLI ve YENI bir fikir oner. Oturum kodu: ${seed}

Asagidaki JSON formatinda SADECE JSON olarak cevap ver:

{
  "appName": "Uygulama adi (yaratici, akilda kalici, Ingilizce)",
  "tagline": "Kisa slogan (max 10 kelime)",
  "description": "3-5 cumle: Ne yapar, kimin icin, hangi basarili urunden ilham alindi, fark ne. Ilham alinan urunun adini ve platformunu (ProductHunt/GitHub) acikca belirt.",
  "features": ["SaaS Ozellik 1", "SaaS Ozellik 2", "SaaS Ozellik 3", "SaaS Ozellik 4", "SaaS Ozellik 5"],
  "techStack": ["Next.js 15", "Supabase", "Tailwind CSS v4", "TypeScript"],
  "targetAudience": "Hedef kitle (SaaS musterileri — B2B veya B2C belirt)",
  "monetization": "SaaS gelir modeli: Free tier + Pro ($X/ay) + Enterprise ($Y/ay) seklinde yaz",
  "uniqueValue": "Ilham alinan urununden ne farki var? Neden kullanicilar bunu secmeli? (1-2 cumle)"
}`;

  const text = await callGemini({
    task: "idea-generation",
    prompt,
    temperature: 0.9,
    topP: 0.95,
    maxOutputTokens: 2048,
    responseMimeType: "application/json",
  });

  try {
    const idea = JSON.parse(text) as IdeaProposal;
    return idea;
  } catch {
    throw new Error("Gemini cevabi JSON olarak parse edilemedi");
  }
}

/** Onayli fikir icin detayli product-spec.md olustur — Pro (derin analiz) */
export async function generateProductSpec(idea: IdeaProposal, category: string): Promise<string> {
  const prompt = `Sen bir teknik urun yoneticisisin. Asagidaki onayli uygulama fikri icin detayli bir product-spec.md dosyasi olustur.

Uygulama Bilgileri:
- Isim: ${idea.appName}
- Slogan: ${idea.tagline}
- Aciklama: ${idea.description}
- Ozellikler: ${idea.features.join(", ")}
- Hedef Kitle: ${idea.targetAudience}
- Gelir Modeli: ${idea.monetization}
- Fark: ${idea.uniqueValue}
- Kategori: ${category}

Markdown formatinda detayli bir product-spec.md yaz. Icermesi gerekenler:
1. # Uygulama Adi
2. ## Ozet
3. ## Problem & Cozum
4. ## Hedef Kitle
5. ## Temel Ozellikler (detayli)
6. ## Kullanici Akislari
7. ## Teknik Gereksinimler
8. ## Tasarim Kilavuzu (renkler, font, genel gorunum)
9. ## MVP Kapsami
10. ## Gelir Modeli
11. ## Basari Metrikleri

Turkce yaz ama uygulama adi Ingilizce olabilir. Cok detayli ve gercekci ol.`;

  return callGemini({
    task: "product-spec",
    prompt,
    temperature: 0.7,
    topP: 0.9,
    maxOutputTokens: 8192,
  });
}
