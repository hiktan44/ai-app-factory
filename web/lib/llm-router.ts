/**
 * LLM Router - Akıllı model yönlendirme
 *
 * Claude pahalı olduğu için sadece kritik/yaratıcı adımlarda kullanılır.
 * Araştırma, analiz ve basit görevler için ücretsiz/ucuz modeller kullanılır.
 */

export type LLMProvider = "claude" | "gemini" | "grok" | "qwen" | "minimax" | "openrouter";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKeyEnvVar: string;
  settingsKey: string;
  label: string;
  description: string;
  costTier: "free" | "cheap" | "medium" | "expensive";
  capabilities: string[];
  maxTokens?: number;
}

export const LLM_CONFIGS: Record<LLMProvider, LLMConfig> = {
  claude: {
    provider: "claude",
    model: "claude-opus-4-5",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    settingsKey: "anthropicApiKey",
    label: "Claude (Anthropic)",
    description: "En güçlü model - kod yazma ve yaratıcı görevler için",
    costTier: "expensive",
    capabilities: ["code", "creative", "reasoning", "architecture"],
  },
  gemini: {
    provider: "gemini",
    model: "gemini-3-flash-preview",
    apiKeyEnvVar: "GEMINI_API_KEY",
    settingsKey: "geminiApiKey",
    label: "Gemini 3 Flash (Google)",
    description: "Hızlı ve ücretsiz - araştırma ve analiz için",
    costTier: "free",
    capabilities: ["research", "analysis", "web-search", "text"],
    maxTokens: 8192,
  },
  grok: {
    provider: "grok",
    model: "grok-3-mini",
    apiKeyEnvVar: "GROK_API_KEY",
    settingsKey: "grokApiKey",
    label: "Grok (xAI)",
    description: "Güncel web bilgisi - trend araştırma için",
    costTier: "cheap",
    capabilities: ["research", "trending", "real-time", "text"],
    maxTokens: 8192,
  },
  qwen: {
    provider: "qwen",
    model: "qwen-plus",
    apiKeyEnvVar: "QWEN_API_KEY",
    settingsKey: "qwenApiKey",
    label: "Qwen (Alibaba)",
    description: "Çok dilli destek - marketing içeriği için",
    costTier: "cheap",
    capabilities: ["multilingual", "text", "analysis"],
    maxTokens: 8192,
  },
  minimax: {
    provider: "minimax",
    model: "MiniMax-Text-01",
    apiKeyEnvVar: "MINIMAX_API_KEY",
    settingsKey: "minimaxApiKey",
    label: "MiniMax",
    description: "Uzun bağlam desteği - doküman analizi için",
    costTier: "cheap",
    capabilities: ["long-context", "text", "analysis"],
    maxTokens: 4096,
  },
  openrouter: {
    provider: "openrouter",
    model: "google/gemma-3-27b-it:free",
    apiKeyEnvVar: "OPENROUTER_API_KEY",
    settingsKey: "openrouterApiKey",
    label: "OpenRouter (Open Source)",
    description: "Açık kaynak modeller - Gemma, Llama, Mistral vb.",
    costTier: "free",
    capabilities: ["text", "code", "analysis"],
    maxTokens: 4096,
  },
};

/**
 * Pipeline adımı → En uygun provider seçimi
 * Claude sadece kritik adımlarda kullanılır
 */
export type PipelineStep =
  | "discover"      // Fikir araştırma → Gemini (ücretsiz web araştırma)
  | "architecture"  // Mimari tasarım → Claude (kritik karar)
  | "build"         // Kod yazma → Claude (en iyi kod kalitesi)
  | "verify_fix"    // Hata düzeltme → Claude (kod anlama gerekli)
  | "review"        // Kod review → Claude veya Gemini
  | "assets"        // SVG/görseller → Gemini veya Claude
  | "marketing"     // Marketing metni → Qwen/Gemini (ucuz metin)
  | "screenshots"   // Ekran görüntüsü → basit betik
  | "package"       // Deploy config → Gemini (template doldurma)
  | "update_learnings"; // Öğrenme güncelleme → Gemini

export const STEP_PROVIDER_MAP: Record<PipelineStep, LLMProvider[]> = {
  discover: ["gemini", "grok", "openrouter", "claude"],       // Önce Gemini, yoksa sıradaki
  architecture: ["claude", "gemini", "openrouter"],            // Önce Claude (kritik)
  build: ["claude", "openrouter", "gemini"],                   // Sadece Claude kaliteli kod yazar
  verify_fix: ["claude", "openrouter", "gemini"],              // Claude en iyi hata düzeltici
  review: ["gemini", "claude", "openrouter"],                  // Gemini yeterli review yapabilir
  assets: ["gemini", "claude", "openrouter"],                  // Gemini SVG üretebilir
  marketing: ["qwen", "gemini", "minimax", "claude"],          // En ucuz metin modeli
  screenshots: ["gemini", "claude"],                           // Gemini yeterli
  package: ["gemini", "claude", "openrouter"],                 // Template doldurma
  update_learnings: ["gemini", "openrouter", "claude"],        // JSON güncelleme
};

/**
 * Mevcut API key'lere göre en iyi provider'ı seç
 */
export function selectProvider(
  step: PipelineStep,
  availableKeys: Partial<Record<LLMProvider, string>>
): LLMProvider {
  const preferredProviders = STEP_PROVIDER_MAP[step];

  for (const provider of preferredProviders) {
    if (availableKeys[provider]) {
      return provider;
    }
  }

  // Fallback: Claude (her zaman mevcut olmalı)
  return "claude";
}

/**
 * Provider için API call wrapper
 */
export async function callLLM(
  provider: LLMProvider,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4096
): Promise<string> {
  switch (provider) {
    case "claude":
      return callClaude(apiKey, systemPrompt, userPrompt, maxTokens);
    case "gemini":
      return callGemini(apiKey, systemPrompt, userPrompt, maxTokens);
    case "grok":
      return callGrok(apiKey, systemPrompt, userPrompt, maxTokens);
    case "qwen":
      return callQwen(apiKey, systemPrompt, userPrompt, maxTokens);
    case "minimax":
      return callMinimax(apiKey, systemPrompt, userPrompt, maxTokens);
    case "openrouter":
      return callOpenRouter(apiKey, systemPrompt, userPrompt, maxTokens);
    default:
      throw new Error(`Bilinmeyen provider: ${provider}`);
  }
}

async function callClaude(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5", // Cost optimization: haiku instead of opus
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API hatası: ${res.status} - ${err}`);
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  return data.content[0]?.text || "";
}

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API hatası: ${res.status} - ${err}`);
  }

  const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  return data.candidates[0]?.content?.parts[0]?.text || "";
}

async function callGrok(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-3-mini",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Grok API hatası: ${res.status} - ${err}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content || "";
}

async function callQwen(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen-plus",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Qwen API hatası: ${res.status} - ${err}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content || "";
}

async function callMinimax(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.minimax.chat/v1/text/chatcompletion_v2", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "MiniMax-Text-01",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax API hatası: ${res.status} - ${err}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content || "";
}

async function callOpenRouter(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ai-app-factory.com",
    },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it:free",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API hatası: ${res.status} - ${err}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content || "";
}
