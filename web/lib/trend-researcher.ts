/**
 * Trend Researcher
 * ProductHunt (günlük/haftalık/aylık en iyiler) ve GitHub Trending verilerini çeker.
 * Gemini ile analiz ederek fikir önerisi için zengin bağlam oluşturur.
 */

import { readSettings } from "./settings";

// ─── Tipler ─────────────────────────────────────────────────────────────────

export interface ProductHuntPost {
  name: string;
  tagline: string;
  description: string;
  votesCount: number;
  commentsCount: number;
  url: string;
  topics: string[];
  isSaas: boolean;
  featuredAt: string;
}

export interface GitHubTrendingRepo {
  name: string;
  fullName: string;
  description: string;
  stars: number;
  starsToday: number;
  forks: number;
  language: string;
  url: string;
  topics: string[];
  builtBy: string[];
}

export interface MarketGap {
  problem: string;
  opportunity: string;
  evidence: string;
}

export interface CompetitorInfo {
  name: string;
  description: string;
  differentiator: string;
  weakness: string;
  source: "producthunt" | "github" | "known";
}

export interface TrendData {
  // ProductHunt
  productHuntDaily: ProductHuntPost[];
  productHuntWeekly: ProductHuntPost[];
  productHuntMonthly: ProductHuntPost[];
  // GitHub
  githubTrendingDaily: GitHubTrendingRepo[];
  githubTrendingWeekly: GitHubTrendingRepo[];
  // Analiz
  marketGaps: MarketGap[];
  competitors: CompetitorInfo[];
  trendingKeywords: string[];
  saasOpportunities: string[];
  // Meta
  fetchedAt: string;
  category: string;
}

export interface IdeaWithTrends {
  // Temel fikir
  appName: string;
  tagline: string;
  description: string;
  features: string[];
  techStack: string[];
  targetAudience: string;
  monetization: string;
  uniqueValue: string;
  // Trend destekli ekler
  isSaas: boolean;
  saasModel: string;
  marketDemand: string;         // Neden şimdi? Trend kanıtları
  marketSize: string;           // Pazar büyüklüğü tahmini
  problemStatement: string;     // Çözdüğü gerçek problem
  competitors: CompetitorInfo[]; // Mevcut rakipler
  differentiators: string[];    // Rakiplerden farkları
  trendEvidence: string[];      // Trend kanıtları (PH/GH kaynaklı)
  mvpFeatures: string[];        // MVP için yeterli olan özellikler
  growthStrategy: string;       // Büyüme stratejisi
  risks: string[];              // Riskler ve mitigation
  // Kaynaklar
  inspirationSources: Array<{
    type: "producthunt" | "github" | "analysis";
    name: string;
    url: string;
    relevance: string;
  }>;
}

// ─── GitHub Trending ─────────────────────────────────────────────────────────

/**
 * GitHub Trending — API ile son yıldızı yükselenleri çeker
 * (Resmi trending API yok; stars+pushed filtresiyle yaklaşım yapılır)
 */
export async function fetchGitHubTrending(
  since: "daily" | "weekly" = "weekly",
  language?: string,
  category?: string
): Promise<GitHubTrendingRepo[]> {
  try {
    const settings = readSettings();
    const githubToken = settings.githubToken || process.env.GITHUB_TOKEN || "";

    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "AI-App-Factory/2.0",
    };
    if (githubToken) {
      headers["Authorization"] = `Bearer ${githubToken}`;
    }

    // Günlük: son 1 gün, haftalık: son 7 gün
    const days = since === "daily" ? 1 : 7;
    const dateCutoff = new Date();
    dateCutoff.setDate(dateCutoff.getDate() - days);
    const dateStr = dateCutoff.toISOString().split("T")[0];

    // Kategori bazlı keyword
    const keywords = category ? getCategoryKeywords(category) : [];
    const keywordQuery = keywords.length > 0
      ? `+${keywords.slice(0, 2).map((k) => `topic:${k}`).join("+OR+")}`
      : "";

    const langFilter = language ? `+language:${language}` : "";
    const query = `stars:>50+pushed:>${dateStr}${langFilter}${keywordQuery}`;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=25`;

    const res = await fetch(url, { headers });
    if (!res.ok) return [];

    const data = await res.json() as {
      items: Array<{
        name: string;
        full_name: string;
        description: string | null;
        stargazers_count: number;
        forks_count: number;
        language: string | null;
        html_url: string;
        topics: string[];
      }>;
    };

    return (data.items || []).map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || "",
      stars: repo.stargazers_count,
      starsToday: 0, // GitHub API bunu doğrudan vermez
      forks: repo.forks_count,
      language: repo.language || "Unknown",
      url: repo.html_url,
      topics: repo.topics || [],
      builtBy: [],
    }));
  } catch (e) {
    console.error("[TrendResearcher] GitHub trending error:", e);
    return [];
  }
}

/**
 * GitHub'da fikre yakın repo ara (rakip/ilham analizi için)
 */
export async function fetchGitHubRelated(
  query: string,
  category: string
): Promise<GitHubTrendingRepo[]> {
  try {
    const settings = readSettings();
    const githubToken = settings.githubToken || process.env.GITHUB_TOKEN || "";

    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "AI-App-Factory/2.0",
    };
    if (githubToken) {
      headers["Authorization"] = `Bearer ${githubToken}`;
    }

    const keywords = getCategoryKeywords(category);
    const allTerms = [
      ...query.toLowerCase().split(" ").filter((w) => w.length > 3).slice(0, 3),
      ...keywords.slice(0, 2),
    ];
    const searchQ = allTerms.join("+OR+");

    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQ)}+stars:>10&sort=stars&order=desc&per_page=15`;
    const res = await fetch(url, { headers });
    if (!res.ok) return [];

    const data = await res.json() as {
      items: Array<{
        name: string;
        full_name: string;
        description: string | null;
        stargazers_count: number;
        forks_count: number;
        language: string | null;
        html_url: string;
        topics: string[];
      }>;
    };

    return (data.items || []).map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || "",
      stars: repo.stargazers_count,
      starsToday: 0,
      forks: repo.forks_count,
      language: repo.language || "Unknown",
      url: repo.html_url,
      topics: repo.topics || [],
      builtBy: [],
    }));
  } catch {
    return [];
  }
}

// ─── ProductHunt ─────────────────────────────────────────────────────────────

/**
 * ProductHunt GraphQL API ile günlük/haftalık/aylık popüler ürünleri çeker
 * https://api.producthunt.com/v2/docs
 */
async function fetchProductHunt(
  period: "daily" | "weekly" | "monthly"
): Promise<ProductHuntPost[]> {
  try {
    // ProductHunt API token — settings veya env'den
    const settings = readSettings();
    const phToken = settings.openrouterApiKey
      ? "" // OpenRouter değil PH token farklı, sadece env var
      : "";
    const token = process.env.PRODUCTHUNT_API_TOKEN || phToken;

    // Token olmadan da çalışır ama rate limit düşük
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Host": "api.producthunt.com",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Tarih aralığı
    const now = new Date();
    let daysBack = 1;
    if (period === "weekly") daysBack = 7;
    if (period === "monthly") daysBack = 30;

    const postedAfter = new Date(now);
    postedAfter.setDate(postedAfter.getDate() - daysBack);

    const query = `
      query {
        posts(order: VOTES, postedAfter: "${postedAfter.toISOString()}", first: 20) {
          edges {
            node {
              name
              tagline
              description
              votesCount
              commentsCount
              url
              website
              featuredAt
              topics {
                edges { node { name slug } }
              }
            }
          }
        }
      }
    `;

    const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });

    if (!res.ok) return [];

    const data = await res.json() as {
      data?: {
        posts?: {
          edges?: Array<{
            node: {
              name: string;
              tagline: string;
              description: string | null;
              votesCount: number;
              commentsCount: number;
              url: string;
              website: string | null;
              featuredAt: string | null;
              topics: { edges: Array<{ node: { name: string; slug: string } }> };
            };
          }>;
        };
      };
    };

    const posts = data?.data?.posts?.edges || [];
    return posts.map(({ node }) => ({
      name: node.name,
      tagline: node.tagline,
      description: node.description || "",
      votesCount: node.votesCount,
      commentsCount: node.commentsCount,
      url: node.url,
      topics: node.topics.edges.map((e) => e.node.name),
      isSaas: isSaasProduct(node.tagline, node.description || "", node.topics.edges.map((e) => e.node.slug)),
      featuredAt: node.featuredAt || "",
    }));
  } catch (e) {
    console.error(`[TrendResearcher] ProductHunt ${period} error:`, e);
    return [];
  }
}

/** Ürünün SaaS olup olmadığını tahmin et */
function isSaasProduct(tagline: string, description: string, topics: string[]): boolean {
  const saasKeywords = ["saas", "subscription", "dashboard", "api", "platform", "tool", "app", "software"];
  const text = (tagline + " " + description + " " + topics.join(" ")).toLowerCase();
  return saasKeywords.some((kw) => text.includes(kw));
}

// ─── Ana araştırma fonksiyonu ─────────────────────────────────────────────────

/**
 * Tüm trend verilerini çeker ve Gemini ile analiz eder
 */
export async function researchTrends(
  category: string,
  ideaHint?: string
): Promise<TrendData> {
  // Paralel veri çekme
  const [
    phDaily,
    phWeekly,
    phMonthly,
    ghDaily,
    ghWeekly,
    ghRelated,
  ] = await Promise.allSettled([
    fetchProductHunt("daily"),
    fetchProductHunt("weekly"),
    fetchProductHunt("monthly"),
    fetchGitHubTrending("daily", undefined, category),
    fetchGitHubTrending("weekly", undefined, category),
    ideaHint ? fetchGitHubRelated(ideaHint, category) : Promise.resolve([]),
  ]);

  const getValue = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
    result.status === "fulfilled" ? result.value : fallback;

  const productHuntDaily = getValue(phDaily, []);
  const productHuntWeekly = getValue(phWeekly, []);
  const productHuntMonthly = getValue(phMonthly, []);
  const githubTrendingDaily = getValue(ghDaily, []);
  const githubTrendingWeekly = getValue(ghWeekly, []);
  const relatedRepos = getValue(ghRelated, []);

  // Birleşik trend anahtar kelimeleri çıkar
  const trendingKeywords = extractTrendingKeywords([
    ...productHuntDaily,
    ...productHuntWeekly,
    ...githubTrendingDaily,
  ]);

  // Rakip analizi
  const competitors = buildCompetitorList(productHuntWeekly, relatedRepos, category);

  // Pazar boşlukları
  const marketGaps = extractMarketGaps(productHuntWeekly, githubTrendingWeekly, category);

  // SaaS fırsatları
  const saasOpportunities = extractSaasOpportunities(productHuntMonthly, githubTrendingWeekly);

  return {
    productHuntDaily: productHuntDaily.slice(0, 10),
    productHuntWeekly: productHuntWeekly.slice(0, 10),
    productHuntMonthly: productHuntMonthly.slice(0, 10),
    githubTrendingDaily: githubTrendingDaily.slice(0, 10),
    githubTrendingWeekly: githubTrendingWeekly.slice(0, 15),
    marketGaps: marketGaps.slice(0, 5),
    competitors: competitors.slice(0, 6),
    trendingKeywords: trendingKeywords.slice(0, 15),
    saasOpportunities: saasOpportunities.slice(0, 5),
    fetchedAt: new Date().toISOString(),
    category,
  };
}

// ─── Analiz yardımcıları ──────────────────────────────────────────────────────

function extractTrendingKeywords(
  posts: (ProductHuntPost | GitHubTrendingRepo)[]
): string[] {
  const freq: Record<string, number> = {};

  for (const item of posts) {
    const text = "tagline" in item
      ? `${item.name} ${item.tagline} ${item.topics.join(" ")}`
      : `${item.name} ${item.description} ${item.topics.join(" ")}`;

    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));

    for (const w of words) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }

  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([word]) => word);
}

function buildCompetitorList(
  phPosts: ProductHuntPost[],
  ghRepos: GitHubTrendingRepo[],
  category: string
): CompetitorInfo[] {
  const competitors: CompetitorInfo[] = [];
  const catKeywords = getCategoryKeywords(category);

  // ProductHunt'tan rakip bul
  for (const post of phPosts.slice(0, 10)) {
    const relevant = catKeywords.some((kw) =>
      (post.name + post.tagline + post.topics.join(" "))
        .toLowerCase()
        .includes(kw)
    );
    if (relevant || competitors.length < 2) {
      competitors.push({
        name: post.name,
        description: post.tagline,
        differentiator: "Bilinmiyor",
        weakness: "Fiyatlandırma veya karmaşık UX",
        source: "producthunt",
      });
    }
    if (competitors.length >= 3) break;
  }

  // GitHub'dan rakip bul
  for (const repo of ghRepos.slice(0, 8)) {
    if (competitors.length >= 6) break;
    competitors.push({
      name: repo.name,
      description: repo.description || repo.fullName,
      differentiator: "Açık kaynak",
      weakness: "Self-hosted, kullanım zorluğu",
      source: "github",
    });
  }

  return competitors;
}

function extractMarketGaps(
  phPosts: ProductHuntPost[],
  ghRepos: GitHubTrendingRepo[],
  category: string
): MarketGap[] {
  const gaps: MarketGap[] = [];
  const keywords = getCategoryKeywords(category);

  // Mevcut çözümlerde ortak şikayetleri tahmin et (yapısal analiz)
  const hasHighVoteTools = phPosts.filter((p) => p.votesCount > 100);
  const hasLowVoteTools = phPosts.filter((p) => p.votesCount < 50);

  if (hasHighVoteTools.length > 0 && hasLowVoteTools.length > 0) {
    gaps.push({
      problem: `${category} kategorisinde mevcut araçlar çok karmaşık veya pahalı`,
      opportunity: "Basit, erişilebilir ve uygun fiyatlı alternatif",
      evidence: `ProductHunt'ta ${hasHighVoteTools.length} yüksek oylanan ürün var — talep kanıtlanmış`,
    });
  }

  const trendingInGH = ghRepos.filter((r) =>
    keywords.some((kw) => r.topics.includes(kw) || r.description.toLowerCase().includes(kw))
  );

  if (trendingInGH.length > 0) {
    gaps.push({
      problem: "Açık kaynak araçların ticari SaaS versiyonu yok",
      opportunity: `${trendingInGH[0]?.name} gibi popüler araçların hosted/managed versiyonu`,
      evidence: `GitHub'da ${trendingInGH[0]?.stars.toLocaleString()}+ yıldız — güçlü topluluk ilgisi`,
    });
  }

  if (keywords.includes("ai") || keywords.includes("automation")) {
    gaps.push({
      problem: "Yapay zeka entegrasyonu gerektiren manüel iş akışları",
      opportunity: "AI-first yaklaşımla otomatikleştirilmiş çözüm",
      evidence: "GitHub trending'deki AI projelerinde hızlı yıldız artışı",
    });
  }

  gaps.push({
    problem: `${category} için mobil-öncelikli çözüm eksikliği`,
    opportunity: "PWA veya native mobile uygulama olarak geliştirilmiş SaaS",
    evidence: "Kullanıcıların masaüstü araçlardan mobil geçiş trendi",
  });

  return gaps;
}

function extractSaasOpportunities(
  phMonthly: ProductHuntPost[],
  ghWeekly: GitHubTrendingRepo[]
): string[] {
  const opps: string[] = [];

  const topPH = phMonthly.filter((p) => p.isSaas && p.votesCount > 200).slice(0, 3);
  for (const p of topPH) {
    opps.push(`"${p.name}" gibi ${p.topics[0] || "SaaS"} alanında fırsat: ${p.tagline}`);
  }

  const topGH = ghWeekly.filter((r) => r.stars > 1000).slice(0, 2);
  for (const r of topGH) {
    opps.push(`"${r.name}" (${r.stars.toLocaleString()}⭐) etrafında managed/hosted servis`);
  }

  return opps;
}

// ─── Gemini ile trend bazlı fikir üretimi ────────────────────────────────────

/**
 * Trend verilerini Gemini'ye göndererek derinlemesine analiz edilmiş fikir üret
 */
export async function generateIdeaWithTrends(
  category: string,
  trendData: TrendData,
  seed: string,
  angle: string
): Promise<IdeaWithTrends> {
  const settings = readSettings();
  const apiKey = (settings.geminiApiKey && !settings.geminiApiKey.includes("●"))
    ? settings.geminiApiKey
    : (process.env.GEMINI_API_KEY || "");

  if (!apiKey) {
    throw new Error("Gemini API key ayarlanmamış. Lütfen /settings sayfasından ekleyin.");
  }

  const trendContext = buildTrendContext(trendData);

  const prompt = `Sen bir startup danışmanı ve ürün stratejistisin. Aşağıdaki güncel trend verilerini analiz ederek ${category} kategorisi için YENİ ve ÖZGÜN bir SaaS fikri öner.

Oturum Kodu: ${seed}
Odak Açısı: ${angle}

═══════════════════════════════════════
GÜNCEL TREND VERİLERİ (${new Date().toLocaleDateString("tr-TR")})
═══════════════════════════════════════

${trendContext}

═══════════════════════════════════════
GÖREV
═══════════════════════════════════════

Bu verilerden ilham alarak:
1. Pazar boşluğunu tespit et
2. Mevcut çözümlerin zayıf noktasını bul
3. Trend doğrulayan benzersiz bir SaaS fikri üret
4. Sadece oturum kodu ${seed} için geçerli, TEK BİR fikir öner

ÖNEMLI: Rakiplerin eksiklerini kapatan, trend verilerle desteklenen bir fikir olsun.

Aşağıdaki JSON formatında SADECE JSON döndür (başka hiçbir şey yazma):

{
  "appName": "Yaratıcı uygulama adı (İngilizce veya Türkçe)",
  "tagline": "10 kelime max slogan",
  "description": "3-4 cümle detaylı açıklama — ne yapar, kim için, farkı ne",
  "features": ["Özellik 1", "Özellik 2", "Özellik 3", "Özellik 4", "Özellik 5"],
  "techStack": ["Next.js 15", "Supabase", "Tailwind CSS", "..."],
  "targetAudience": "Kimin için? Demografik ve psikografik detay",
  "monetization": "Fiyatlandırma modeli ve tier'lar",
  "uniqueValue": "Rakiplerden tek cümleyle farkı",
  "isSaas": true,
  "saasModel": "Freemium / Subscription / Usage-based / Enterprise — hangisi ve neden",
  "marketDemand": "Neden şimdi? Hangi trend bunu destekliyor? Somut kanıt",
  "marketSize": "TAM/SAM/SOM tahmini",
  "problemStatement": "Çözdüğü gerçek ve acı veren problem",
  "competitors": [
    {"name": "Rakip adı", "description": "Ne yapar", "differentiator": "Ondan farkımız", "weakness": "Zayıflığı", "source": "producthunt"}
  ],
  "differentiators": ["Fark 1", "Fark 2", "Fark 3"],
  "trendEvidence": ["Kanıt 1 (kaynak belirt)", "Kanıt 2", "Kanıt 3"],
  "mvpFeatures": ["MVP özellik 1", "MVP özellik 2", "MVP özellik 3"],
  "growthStrategy": "İlk 100 kullanıcı nasıl kazanılır?",
  "risks": ["Risk 1 ve nasıl azaltılır", "Risk 2"],
  "inspirationSources": [
    {"type": "producthunt", "name": "İlham alınan ürün", "url": "url", "relevance": "Nasıl ilham verdi"}
  ]
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          maxOutputTokens: 3000,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API hatası: ${res.status} — ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini boş yanıt döndürdü");

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON bulunamadı");
    return JSON.parse(jsonMatch[0]) as IdeaWithTrends;
  } catch {
    throw new Error("Gemini yanıtı JSON olarak parse edilemedi");
  }
}

// ─── Bağlam oluşturma ─────────────────────────────────────────────────────────

function buildTrendContext(data: TrendData): string {
  const lines: string[] = [];

  // ProductHunt Günlük
  if (data.productHuntDaily.length > 0) {
    lines.push("## 📈 ProductHunt — BUGÜNÜN EN İYİLERİ");
    for (const p of data.productHuntDaily.slice(0, 5)) {
      lines.push(`• **${p.name}** (${p.votesCount}🔺) — ${p.tagline}`);
      if (p.topics.length > 0) lines.push(`  Konular: ${p.topics.slice(0, 4).join(", ")}`);
    }
    lines.push("");
  }

  // ProductHunt Haftalık
  if (data.productHuntWeekly.length > 0) {
    lines.push("## 🔥 ProductHunt — BU HAFTANİN EN İYİLERİ");
    for (const p of data.productHuntWeekly.slice(0, 5)) {
      lines.push(`• **${p.name}** (${p.votesCount}🔺) — ${p.tagline}`);
      if (p.isSaas) lines.push(`  ✅ SaaS ürün`);
    }
    lines.push("");
  }

  // ProductHunt Aylık
  if (data.productHuntMonthly.length > 0) {
    lines.push("## 🏆 ProductHunt — BU AYIN EN İYİLERİ");
    for (const p of data.productHuntMonthly.slice(0, 5)) {
      lines.push(`• **${p.name}** (${p.votesCount}🔺) — ${p.tagline}`);
    }
    lines.push("");
  }

  // GitHub Günlük Trending
  if (data.githubTrendingDaily.length > 0) {
    lines.push("## ⚡ GitHub — BUGÜN YENİ YILDIZ ALAN PROJELER");
    for (const r of data.githubTrendingDaily.slice(0, 6)) {
      lines.push(`• **${r.name}** (${r.stars.toLocaleString()}⭐ ${r.language}) — ${r.description}`);
      if (r.topics.length > 0) lines.push(`  Etiketler: ${r.topics.slice(0, 4).join(", ")}`);
    }
    lines.push("");
  }

  // GitHub Haftalık Trending
  if (data.githubTrendingWeekly.length > 0) {
    lines.push("## 📊 GitHub — BU HAFTA EN ÇOK YILDIZ ALAN PROJELER");
    for (const r of data.githubTrendingWeekly.slice(0, 8)) {
      lines.push(`• **${r.name}** (${r.stars.toLocaleString()}⭐) — ${r.description}`);
    }
    lines.push("");
  }

  // Pazar Boşlukları
  if (data.marketGaps.length > 0) {
    lines.push("## 🎯 TESPIT EDİLEN PAZAR BOŞLUKLARI");
    for (const g of data.marketGaps) {
      lines.push(`• Problem: ${g.problem}`);
      lines.push(`  Fırsat: ${g.opportunity}`);
      lines.push(`  Kanıt: ${g.evidence}`);
    }
    lines.push("");
  }

  // Trend Anahtar Kelimeler
  if (data.trendingKeywords.length > 0) {
    lines.push(`## 🏷️ TREND ANAHTAR KELİMELER: ${data.trendingKeywords.slice(0, 12).join(", ")}`);
    lines.push("");
  }

  // SaaS Fırsatları
  if (data.saasOpportunities.length > 0) {
    lines.push("## 💡 SAAS FIRSATLARI");
    for (const o of data.saasOpportunities) {
      lines.push(`• ${o}`);
    }
    lines.push("");
  }

  return lines.join("\n") || "Trend verisi bulunamadı — genel pazar bilgisiyle devam et.";
}

// ─── Yardımcı ────────────────────────────────────────────────────────────────

function getCategoryKeywords(category: string): string[] {
  const map: Record<string, string[]> = {
    productivity: ["productivity", "task", "workflow", "automation", "gtd", "focus"],
    "developer-tools": ["devtools", "cli", "api", "debugging", "testing", "ci"],
    health: ["health", "fitness", "wellness", "mental-health", "nutrition", "sleep"],
    finance: ["finance", "budget", "investment", "accounting", "expense", "fintech"],
    education: ["education", "learning", "lms", "course", "quiz", "edtech"],
    entertainment: ["game", "media", "streaming", "social", "content"],
    ecommerce: ["ecommerce", "shop", "marketplace", "payment", "b2b"],
    saas: ["saas", "dashboard", "analytics", "crm", "b2b"],
    ai: ["ai", "llm", "machine-learning", "nlp", "computer-vision", "openai"],
    marketing: ["marketing", "seo", "email", "social-media", "analytics", "growth"],
    hr: ["hr", "recruiting", "payroll", "onboarding", "employee"],
    legal: ["legal", "contract", "compliance", "law", "gdpr"],
  };
  return map[category] || [category, "saas", "tool", "app"];
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "your", "that", "this", "from", "have",
  "been", "more", "than", "into", "about", "their", "what", "when",
  "also", "make", "made", "just", "like", "will", "you", "can",
  "bir", "ile", "için", "daha", "olan", "gibi", "veya", "her",
]);
