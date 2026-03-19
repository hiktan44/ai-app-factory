/**
 * Idea Researcher - GitHub, HuggingFace ve web'den fikir araştırma
 */

export interface TrendingRepo {
  name: string;
  fullName: string;
  description: string;
  stars: number;
  language: string;
  url: string;
  topics: string[];
  weeklyStars?: number;
}

export interface HuggingFaceSpace {
  id: string;
  title: string;
  description: string;
  likes: number;
  tags: string[];
  url: string;
}

export interface ResearchResult {
  githubTrending: TrendingRepo[];
  huggingFaceSpaces: HuggingFaceSpace[];
  relatedRepos: TrendingRepo[];
  insights: string[];
  timestamp: string;
}

export interface EnhancedIdea {
  originalIdea: string;
  enhancedIdea: string;
  appName: string;
  tagline: string;
  keyFeatures: string[];
  targetAudience: string;
  monetizationStrategy: string;
  techStack: string[];
  competitorAnalysis: string;
  uniqueValueProp: string;
  mvpScope: string;
  researchSources: string[];
  category: string;
}

/**
 * GitHub Trending - bu hafta trend olan repolar
 */
export async function fetchGitHubTrending(
  language?: string,
  since: "daily" | "weekly" | "monthly" = "weekly"
): Promise<TrendingRepo[]> {
  try {
    // GitHub'ın resmi trending API'si yok, scrape ederiz
    // Alternatif: github-trending-api kullanabiliriz
    const url = `https://api.github.com/search/repositories?q=stars:>500+pushed:>${getDateBefore(7)}&sort=stars&order=desc&per_page=20${language ? `+language:${language}` : ""}`;

    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "AI-App-Factory",
    };

    const githubToken = process.env.GITHUB_TOKEN;
    if (githubToken) {
      headers["Authorization"] = `token ${githubToken}`;
    }

    const res = await fetch(url, { headers, next: { revalidate: 3600 } });

    if (!res.ok) return [];

    const data = await res.json() as {
      items: Array<{
        name: string;
        full_name: string;
        description: string;
        stargazers_count: number;
        language: string;
        html_url: string;
        topics: string[];
      }>
    };

    return (data.items || []).map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || "",
      stars: repo.stargazers_count,
      language: repo.language || "Unknown",
      url: repo.html_url,
      topics: repo.topics || [],
    }));
  } catch {
    return [];
  }
}

/**
 * GitHub'da kategori ile ilgili popüler repolar
 */
export async function fetchGitHubByCategory(category: string): Promise<TrendingRepo[]> {
  try {
    const keywords = getCategoryKeywords(category);
    const query = keywords.slice(0, 3).join("+OR+");
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+stars:>100&sort=stars&order=desc&per_page=15`;

    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "AI-App-Factory",
    };

    const githubToken = process.env.GITHUB_TOKEN;
    if (githubToken) {
      headers["Authorization"] = `token ${githubToken}`;
    }

    const res = await fetch(url, { headers, next: { revalidate: 3600 } });
    if (!res.ok) return [];

    const data = await res.json() as {
      items: Array<{
        name: string;
        full_name: string;
        description: string;
        stargazers_count: number;
        language: string;
        html_url: string;
        topics: string[];
      }>
    };

    return (data.items || []).map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || "",
      stars: repo.stargazers_count,
      language: repo.language || "Unknown",
      url: repo.html_url,
      topics: repo.topics || [],
    }));
  } catch {
    return [];
  }
}

/**
 * HuggingFace Spaces - trend olan AI uygulamaları
 */
export async function fetchHuggingFaceSpaces(query?: string): Promise<HuggingFaceSpace[]> {
  try {
    const url = query
      ? `https://huggingface.co/api/spaces?search=${encodeURIComponent(query)}&limit=15&sort=likes`
      : `https://huggingface.co/api/spaces?limit=15&sort=likes`;

    const res = await fetch(url, {
      headers: { "User-Agent": "AI-App-Factory" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];

    const data = await res.json() as Array<{
      id: string;
      cardData?: { title?: string; short_description?: string; tags?: string[] };
      likes: number;
    }>;

    return (Array.isArray(data) ? data : []).map((space) => ({
      id: space.id,
      title: space.cardData?.title || space.id.split("/")[1] || space.id,
      description: space.cardData?.short_description || "",
      likes: space.likes || 0,
      tags: space.cardData?.tags || [],
      url: `https://huggingface.co/spaces/${space.id}`,
    }));
  } catch {
    return [];
  }
}

/**
 * Kullanıcı fikrine göre tam araştırma yap
 */
export async function researchIdea(
  userIdea: string,
  category: string
): Promise<ResearchResult> {
  const [githubTrending, relatedRepos, huggingFaceSpaces] = await Promise.all([
    fetchGitHubTrending(undefined, "weekly"),
    fetchGitHubByCategory(category),
    fetchHuggingFaceSpaces(userIdea.split(" ").slice(0, 3).join(" ")),
  ]);

  // Fikirle ilgili insights üret
  const insights: string[] = [];

  const topTrending = githubTrending.slice(0, 5);
  if (topTrending.length > 0) {
    insights.push(`GitHub'da bu hafta trend: ${topTrending.map((r) => r.name).join(", ")}`);
  }

  const topSpaces = huggingFaceSpaces.slice(0, 3);
  if (topSpaces.length > 0) {
    insights.push(`HuggingFace'de benzer AI uygulamaları: ${topSpaces.map((s) => s.title).join(", ")}`);
  }

  const relevantRepos = relatedRepos.slice(0, 5);
  if (relevantRepos.length > 0) {
    insights.push(`${category} kategorisinde popüler projeler: ${relevantRepos.map((r) => r.name).join(", ")}`);
  }

  return {
    githubTrending,
    huggingFaceSpaces,
    relatedRepos,
    insights,
    timestamp: new Date().toISOString(),
  };
}

/**
 * LLM ile fikri geliştir
 */
export async function enhanceIdeaWithLLM(
  userIdea: string,
  category: string,
  research: ResearchResult,
  llmApiKey: string,
  llmProvider: "gemini" | "claude" = "gemini"
): Promise<EnhancedIdea> {
  const researchContext = buildResearchContext(research);

  const systemPrompt = `Sen bir startup fikir geliştirme uzmanısın. Kullanıcının ham fikrini, mevcut pazar araştırması ve trend verilerle zenginleştiriyorsun.

Kurallar:
- Gerçekçi ve uygulanabilir MVP öner
- Mevcut trendleri ve boşlukları değerlendir
- Benzersiz değer önerisi oluştur
- Teknik implementasyon için Next.js + Supabase stack'i öner
- JSON formatında yanıt ver`;

  const userPrompt = `Kullanıcı fikri: "${userIdea}"
Kategori: ${category}

Pazar Araştırması:
${researchContext}

Yukarıdaki araştırma verilerini kullanarak bu fikri geliştir ve JSON döndür:
{
  "originalIdea": "${userIdea}",
  "enhancedIdea": "geliştirилmiş detaylı fikir açıklaması",
  "appName": "uygulama adı",
  "tagline": "kısa slogan",
  "keyFeatures": ["özellik1", "özellik2", "özellik3", "özellik4", "özellik5"],
  "targetAudience": "hedef kitle",
  "monetizationStrategy": "para kazanma modeli",
  "techStack": ["Next.js 15", "Supabase", "Tailwind CSS", "..."],
  "competitorAnalysis": "rakip analizi",
  "uniqueValueProp": "benzersiz değer önerisi",
  "mvpScope": "MVP kapsamı - ne yapılacak ne yapılmayacak",
  "researchSources": ["kaynak1", "kaynak2"],
  "category": "${category}"
}`;

  try {
    let responseText = "";

    if (llmProvider === "gemini" && llmApiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${llmApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
          }),
        }
      );

      if (res.ok) {
        const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
        responseText = data.candidates[0]?.content?.parts[0]?.text || "";
      }
    } else if (llmProvider === "claude" && llmApiKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": llmApiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json() as { content: Array<{ text: string }> };
        responseText = data.content[0]?.text || "";
      }
    }

    // JSON parse
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as EnhancedIdea;
      return parsed;
    }
  } catch (e) {
    console.error("LLM enhance error:", e);
  }

  // Fallback
  return {
    originalIdea: userIdea,
    enhancedIdea: userIdea,
    appName: generateAppName(userIdea),
    tagline: `${userIdea} için akıllı çözüm`,
    keyFeatures: ["Temel özellik 1", "Temel özellik 2", "Temel özellik 3"],
    targetAudience: "Genel kullanıcılar",
    monetizationStrategy: "Freemium model",
    techStack: ["Next.js 15", "Supabase", "Tailwind CSS", "TypeScript"],
    competitorAnalysis: "Pazar araştırması gerekli",
    uniqueValueProp: "Benzersiz değer önerisi",
    mvpScope: "Temel özellikler",
    researchSources: [],
    category,
  };
}

// ─── Yardımcı fonksiyonlar ───────────────────────────────

function getDateBefore(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function getCategoryKeywords(category: string): string[] {
  const keywordMap: Record<string, string[]> = {
    productivity: ["productivity", "task-manager", "todo", "workflow", "automation"],
    "developer-tools": ["developer-tools", "cli", "api", "devops", "debugging"],
    health: ["health", "fitness", "wellness", "medical", "nutrition"],
    finance: ["finance", "budget", "investment", "accounting", "expense"],
    education: ["education", "learning", "course", "tutorial", "quiz"],
    entertainment: ["entertainment", "game", "media", "streaming", "social"],
    ecommerce: ["ecommerce", "shop", "marketplace", "store", "payment"],
    saas: ["saas", "dashboard", "analytics", "crm", "management"],
  };

  return keywordMap[category] || [category, "app", "tool"];
}

function buildResearchContext(research: ResearchResult): string {
  const lines: string[] = [];

  if (research.githubTrending.length > 0) {
    lines.push("## GitHub Trending Bu Hafta:");
    research.githubTrending.slice(0, 8).forEach((repo) => {
      lines.push(`- **${repo.name}** (${repo.stars.toLocaleString()} ⭐): ${repo.description}`);
    });
  }

  if (research.relatedRepos.length > 0) {
    lines.push("\n## İlgili Popüler Projeler:");
    research.relatedRepos.slice(0, 8).forEach((repo) => {
      lines.push(`- **${repo.name}** (${repo.stars.toLocaleString()} ⭐): ${repo.description}`);
    });
  }

  if (research.huggingFaceSpaces.length > 0) {
    lines.push("\n## HuggingFace'deki Benzer AI Uygulamaları:");
    research.huggingFaceSpaces.slice(0, 6).forEach((space) => {
      lines.push(`- **${space.title}** (${space.likes} 👍): ${space.description}`);
    });
  }

  return lines.join("\n") || "Araştırma verisi bulunamadı.";
}

function generateAppName(idea: string): string {
  const words = idea.split(" ").slice(0, 2).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join("") + "AI";
}
