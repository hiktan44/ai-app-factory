"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SettingsForm {
  // LLM Keys
  claudeOauthToken: string;
  anthropicApiKey: string;
  geminiApiKey: string;
  grokApiKey: string;
  qwenApiKey: string;
  minimaxApiKey: string;
  openrouterApiKey: string;
  // Git & Deploy
  githubToken: string;
  githubOrg: string;
  coolifyApiUrl: string;
  coolifyApiToken: string;
  // Pipeline
  maxTurns: number;
  maxConcurrentRuns: number;
}

interface TestState {
  [key: string]: "idle" | "testing" | "ok" | "fail";
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsForm>({
    claudeOauthToken: "",
    anthropicApiKey: "",
    geminiApiKey: "",
    grokApiKey: "",
    qwenApiKey: "",
    minimaxApiKey: "",
    openrouterApiKey: "",
    githubToken: "",
    githubOrg: "",
    coolifyApiUrl: "",
    coolifyApiToken: "",
    maxTurns: 50,
    maxConcurrentRuns: 1,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testStates, setTestStates] = useState<TestState>({});

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: SettingsForm) => setSettings(data))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Ayarlar kaydedildi!" });
      } else {
        setMessage({ type: "error", text: "Kaydetme başarısız" });
      }
    } catch {
      setMessage({ type: "error", text: "Bağlantı hatası" });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (service: string) => {
    setTestStates((prev) => ({ ...prev, [service]: "testing" }));
    try {
      const res = await fetch(`/api/settings/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, settings }),
      });
      const data = await res.json() as { success: boolean; message?: string };
      setTestStates((prev) => ({ ...prev, [service]: data.success ? "ok" : "fail" }));
      setMessage({
        type: data.success ? "success" : "error",
        text: data.message || (data.success ? `${service} bağlantısı başarılı!` : `${service} bağlantısı başarısız`),
      });
    } catch {
      setTestStates((prev) => ({ ...prev, [service]: "fail" }));
      setMessage({ type: "error", text: `${service} test hatası` });
    }
  };

  const update = (key: keyof SettingsForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings((prev) => ({ ...prev, [key]: e.target.value }));

  const inputClass =
    "w-full rounded-xl border border-edge bg-surface-tertiary px-4 py-3 text-sm text-content focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-all placeholder:text-content-muted font-mono";

  const TestBtn = ({ service, keyField }: { service: string; keyField: keyof SettingsForm }) => {
    const state = testStates[service] || "idle";
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => testConnection(service)}
        disabled={state === "testing" || !settings[keyField]}
      >
        {state === "testing" ? "Test ediliyor..." : state === "ok" ? "✅ Bağlı" : state === "fail" ? "❌ Başarısız" : "🔗 Test Et"}
      </Button>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-content">Ayarlar</h1>
        <p className="text-content-secondary mt-2">
          API anahtarları ve deploy yapılandırmasını buradan yönetin. Claude maliyetli olduğundan diğer AI'lar araştırma/metin görevlerinde kullanılır.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-xl border p-4 text-sm animate-fade-in ${
            message.type === "success"
              ? "bg-success/10 border-success/20 text-success"
              : "bg-danger/10 border-danger/20 text-danger"
          }`}
        >
          {message.type === "success" ? "✅" : "❌"} {message.text}
        </div>
      )}

      {/* LLM Routing Info */}
      <Card className="p-5 border-brand/20 bg-brand/5 animate-fade-in">
        <h3 className="font-semibold text-content mb-2">🧠 Akıllı LLM Yönlendirme</h3>
        <div className="text-xs text-content-secondary space-y-1">
          <p><span className="text-brand font-medium">Claude</span> → Mimari tasarım, kod yazma, hata düzeltme (kritik adımlar)</p>
          <p><span className="text-blue-400 font-medium">Gemini Flash</span> → Fikir araştırma, GitHub/HuggingFace analizi, assets (ücretsiz)</p>
          <p><span className="text-orange-400 font-medium">Grok</span> → Trend araştırma, gerçek zamanlı web bilgisi</p>
          <p><span className="text-green-400 font-medium">Qwen/MiniMax</span> → Marketing metni, çok dilli içerik (ucuz)</p>
          <p><span className="text-purple-400 font-medium">OpenRouter</span> → Açık kaynak modeller (ücretsiz seçenekler)</p>
        </div>
      </Card>

      {/* ─── LLM API Keys ─────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-content mb-4">🤖 AI Model API Anahtarları</h2>

        {/* Claude OAuth (Max Plan) */}
        <Card className="p-6 animate-fade-in mb-4 border-2 border-green-500/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-xl">🔑</div>
            <div>
              <h3 className="font-semibold text-content">Claude OAuth Token <span className="text-xs text-green-400 ml-1">Max Plan (Önerilen)</span></h3>
              <p className="text-xs text-content-muted">Max Plan aboneliğinizle ücretsiz kullanım — API key&apos;den önceliklidir</p>
            </div>
          </div>
          <div className="space-y-3">
            <input type="password" value={settings.claudeOauthToken} onChange={update("claudeOauthToken")} placeholder="sk-ant-oat01-..." className={inputClass} />
            <TestBtn service="anthropic" keyField="claudeOauthToken" />
          </div>
        </Card>

        {/* Claude API Key (alternatif) */}
        <Card className="p-6 animate-fade-in mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-xl">🧠</div>
            <div>
              <h3 className="font-semibold text-content">Claude API Key (Anthropic) <span className="text-xs text-content-muted ml-1">Alternatif — kullandıkça öde</span></h3>
              <p className="text-xs text-content-muted">OAuth token yoksa API key kullanılır</p>
            </div>
          </div>
          <div className="space-y-3">
            <input type="password" value={settings.anthropicApiKey} onChange={update("anthropicApiKey")} placeholder="sk-ant-api03-..." className={inputClass} />
            <TestBtn service="anthropic" keyField="anthropicApiKey" />
          </div>
        </Card>

        {/* Gemini */}
        <Card className="p-6 animate-fade-in mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xl">✨</div>
            <div>
              <h3 className="font-semibold text-content">Gemini Flash (Google) <span className="text-xs text-success ml-1">Ücretsiz</span></h3>
              <p className="text-xs text-content-muted">Araştırma, analiz, asset üretimi</p>
            </div>
          </div>
          <div className="space-y-3">
            <input type="password" value={settings.geminiApiKey} onChange={update("geminiApiKey")} placeholder="AIza..." className={inputClass} />
            <TestBtn service="gemini" keyField="geminiApiKey" />
          </div>
        </Card>

        {/* Grok */}
        <Card className="p-6 animate-fade-in mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-xl">⚡</div>
            <div>
              <h3 className="font-semibold text-content">Grok (xAI) <span className="text-xs text-yellow-400 ml-1">Ucuz</span></h3>
              <p className="text-xs text-content-muted">Trend araştırma, gerçek zamanlı web bilgisi</p>
            </div>
          </div>
          <div className="space-y-3">
            <input type="password" value={settings.grokApiKey} onChange={update("grokApiKey")} placeholder="xai-..." className={inputClass} />
            <TestBtn service="grok" keyField="grokApiKey" />
          </div>
        </Card>

        {/* Qwen */}
        <Card className="p-6 animate-fade-in mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-xl">🌐</div>
            <div>
              <h3 className="font-semibold text-content">Qwen (Alibaba) <span className="text-xs text-yellow-400 ml-1">Ucuz</span></h3>
              <p className="text-xs text-content-muted">Marketing metni, çok dilli içerik (EN/TR)</p>
            </div>
          </div>
          <div className="space-y-3">
            <input type="password" value={settings.qwenApiKey} onChange={update("qwenApiKey")} placeholder="sk-..." className={inputClass} />
            <TestBtn service="qwen" keyField="qwenApiKey" />
          </div>
        </Card>

        {/* MiniMax */}
        <Card className="p-6 animate-fade-in mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-xl">🔮</div>
            <div>
              <h3 className="font-semibold text-content">MiniMax <span className="text-xs text-yellow-400 ml-1">Ucuz</span></h3>
              <p className="text-xs text-content-muted">Uzun bağlam, doküman analizi</p>
            </div>
          </div>
          <div className="space-y-3">
            <input type="password" value={settings.minimaxApiKey} onChange={update("minimaxApiKey")} placeholder="..." className={inputClass} />
            <TestBtn service="minimax" keyField="minimaxApiKey" />
          </div>
        </Card>

        {/* OpenRouter */}
        <Card className="p-6 animate-fade-in mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-xl">🔓</div>
            <div>
              <h3 className="font-semibold text-content">OpenRouter <span className="text-xs text-success ml-1">Ücretsiz modeller</span></h3>
              <p className="text-xs text-content-muted">Gemma, Llama, Mistral gibi açık kaynak modeller</p>
            </div>
          </div>
          <div className="space-y-3">
            <input type="password" value={settings.openrouterApiKey} onChange={update("openrouterApiKey")} placeholder="sk-or-..." className={inputClass} />
            <TestBtn service="openrouter" keyField="openrouterApiKey" />
          </div>
        </Card>
      </div>

      {/* ─── Git & Deploy ─────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-content mb-4">🚀 Git & Deploy</h2>

        {/* GitHub */}
        <Card className="p-6 animate-fade-in mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-xl">🐙</div>
            <div>
              <h3 className="font-semibold text-content">GitHub</h3>
              <p className="text-xs text-content-muted">Üretilen projeleri push etmek için</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-content-secondary mb-1.5">Personal Access Token</label>
              <input type="password" value={settings.githubToken} onChange={update("githubToken")} placeholder="ghp_..." className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-content-secondary mb-1.5">Organizasyon / Kullanıcı Adı</label>
              <input type="text" value={settings.githubOrg} onChange={update("githubOrg")} placeholder="kullanici-adi" className={inputClass} />
            </div>
            <TestBtn service="github" keyField="githubToken" />
          </div>
        </Card>

        {/* Coolify */}
        <Card className="p-6 animate-fade-in mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl">☁️</div>
            <div>
              <h3 className="font-semibold text-content">Coolify</h3>
              <p className="text-xs text-content-muted">Otomatik deployment için</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-content-secondary mb-1.5">API URL</label>
              <input type="url" value={settings.coolifyApiUrl} onChange={update("coolifyApiUrl")} placeholder="https://coolify.example.com" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-content-secondary mb-1.5">API Token</label>
              <input type="password" value={settings.coolifyApiToken} onChange={update("coolifyApiToken")} placeholder="Bearer token..." className={inputClass} />
            </div>
            <TestBtn service="coolify" keyField="coolifyApiToken" />
          </div>
        </Card>
      </div>

      {/* ─── Pipeline Ayarları ─────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-content mb-4">⚙️ Pipeline Ayarları</h2>

        <Card className="p-6 animate-fade-in mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-xl">🔄</div>
            <div>
              <h3 className="font-semibold text-content">Maksimum Tur Sayısı</h3>
              <p className="text-xs text-content-muted">Her adımda Claude&apos;un alabileceği maksimum ajan turu. Büyük projeler için artırın.</p>
            </div>
          </div>
          <div className="space-y-3">
            <input
              type="number"
              min={10}
              max={200}
              value={settings.maxTurns}
              onChange={(e) => setSettings((prev) => ({ ...prev, maxTurns: Math.max(10, Math.min(200, parseInt(e.target.value) || 50)) }))}
              className={inputClass}
            />
            <p className="text-xs text-content-muted">Min: 10, Max: 200 — Varsayılan: 50</p>
          </div>
        </Card>

        <Card className="p-6 animate-fade-in mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-xl">⚡</div>
            <div>
              <h3 className="font-semibold text-content">Eşzamanlı Pipeline Sayısı</h3>
              <p className="text-xs text-content-muted">Aynı anda çalışabilecek pipeline sayısı. Sunucu kapasitesine göre ayarlayın.</p>
            </div>
          </div>
          <div className="space-y-3">
            <input
              type="number"
              min={1}
              max={5}
              value={settings.maxConcurrentRuns}
              onChange={(e) => setSettings((prev) => ({ ...prev, maxConcurrentRuns: Math.max(1, Math.min(5, parseInt(e.target.value) || 1)) }))}
              className={inputClass}
            />
            <p className="text-xs text-content-muted">Min: 1, Max: 5 — Varsayılan: 1</p>
          </div>
        </Card>
      </div>

      {/* Save */}
      <Button size="lg" className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Kaydediliyor..." : "💾 Ayarları Kaydet"}
      </Button>
    </div>
  );
}
