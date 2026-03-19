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

/** Kategori icin yenilikci uygulama fikri uret — Flash (hizli, yaratici) */
export async function generateIdea(category: string): Promise<IdeaProposal> {
  // Her çağrıda farklı fikir üretmek için rastgele bir tohum değeri ekle
  const seed = Math.random().toString(36).substring(2, 8);
  const angles = [
    "niş bir alt segmente odaklan",
    "B2B SaaS olarak tasarla",
    "mobil-öncelikli bir yaklaşım benimse",
    "yapay zeka destekli otomasyon ön plana çıkar",
    "topluluk ve sosyal özellikler ekle",
    "freelancer ve solo girişimcilere hitap et",
    "küçük işletmelere odaklan",
    "eğitim ve öğrenme boyutu ekle",
    "no-code kullanıcıları hedefle",
    "abonelik ekonomisini ön plana çıkar",
  ];
  const randomAngle = angles[Math.floor(Math.random() * angles.length)];

  const prompt = `Sen bir yapay zeka uygulama fabrikasisin. Asagidaki kategori icin yenilikci, gercekci ve gelistirilebilir bir SaaS web uygulamasi fikri oner.

Kategori: ${category}
Oturum: ${seed}
Odak acisi: ${randomAngle}

ONEMLI: Her seferinde tamamen FARKLI ve YENI bir fikir oner. Onceki fikirlerden ilham alma. Bu oturum kodu benzersiz bir fikir uret: ${seed}

Asagidaki JSON formatinda SADECE JSON olarak cevap ver, baska hicbir sey yazma:

{
  "appName": "Uygulama adi (yaratici, akilda kalici)",
  "tagline": "Kisa slogan (max 10 kelime)",
  "description": "Detayli aciklama (3-5 cumle, uygulamanin ne yaptigini, hedef kitleyi ve farkini anlat)",
  "features": ["Ozellik 1", "Ozellik 2", "Ozellik 3", "Ozellik 4", "Ozellik 5"],
  "techStack": ["Next.js", "Tailwind CSS", "diger teknolojiler"],
  "targetAudience": "Hedef kitle aciklamasi",
  "monetization": "Gelir modeli",
  "uniqueValue": "Rakiplerden ne farki var (1-2 cumle)"
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
