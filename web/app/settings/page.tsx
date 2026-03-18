"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SettingsForm {
  geminiApiKey: string;
  githubToken: string;
  githubOrg: string;
  coolifyApiUrl: string;
  coolifyApiToken: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsForm>({
    geminiApiKey: "",
    githubToken: "",
    githubOrg: "",
    coolifyApiUrl: "",
    coolifyApiToken: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testingGemini, setTestingGemini] = useState(false);
  const [testingGithub, setTestingGithub] = useState(false);
  const [testingCoolify, setTestingCoolify] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings(data))
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
    if (service === "gemini") setTestingGemini(true);
    if (service === "github") setTestingGithub(true);
    if (service === "coolify") setTestingCoolify(true);

    try {
      const res = await fetch(`/api/settings/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, settings }),
      });
      const data = await res.json();
      setMessage({
        type: data.success ? "success" : "error",
        text: data.message || (data.success ? `${service} bağlantısı başarılı!` : `${service} bağlantısı başarısız`),
      });
    } catch {
      setMessage({ type: "error", text: `${service} test hatası` });
    } finally {
      setTestingGemini(false);
      setTestingGithub(false);
      setTestingCoolify(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-edge bg-surface-tertiary px-4 py-3 text-sm text-content focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-all placeholder:text-content-muted font-mono";

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-content">Ayarlar</h1>
        <p className="text-content-secondary mt-2">
          API anahtarları ve deploy yapılandırmasını buradan yönetin.
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

      {/* Gemini API */}
      <Card className="p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xl">
            🤖
          </div>
          <div>
            <h2 className="text-lg font-semibold text-content">Gemini API</h2>
            <p className="text-xs text-content-muted">Fikir üretimi için Google Gemini</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-content-secondary mb-1.5">
              API Key
            </label>
            <input
              type="password"
              value={settings.geminiApiKey}
              onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
              placeholder="AIza..."
              className={inputClass}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => testConnection("gemini")}
            disabled={testingGemini || !settings.geminiApiKey}
          >
            {testingGemini ? "Test ediliyor..." : "🔗 Bağlantı Test Et"}
          </Button>
        </div>
      </Card>

      {/* GitHub */}
      <Card className="p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-xl">
            🐙
          </div>
          <div>
            <h2 className="text-lg font-semibold text-content">GitHub</h2>
            <p className="text-xs text-content-muted">Üretilen projeleri push etmek için</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-content-secondary mb-1.5">
              Personal Access Token
            </label>
            <input
              type="password"
              value={settings.githubToken}
              onChange={(e) => setSettings({ ...settings, githubToken: e.target.value })}
              placeholder="ghp_..."
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-content-secondary mb-1.5">
              Organizasyon / Kullanıcı Adı
            </label>
            <input
              type="text"
              value={settings.githubOrg}
              onChange={(e) => setSettings({ ...settings, githubOrg: e.target.value })}
              placeholder="kullanici-adi"
              className={inputClass}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => testConnection("github")}
            disabled={testingGithub || !settings.githubToken}
          >
            {testingGithub ? "Test ediliyor..." : "🔗 Bağlantı Test Et"}
          </Button>
        </div>
      </Card>

      {/* Coolify */}
      <Card className="p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl">
            ☁️
          </div>
          <div>
            <h2 className="text-lg font-semibold text-content">Coolify</h2>
            <p className="text-xs text-content-muted">Otomatik deployment için</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-content-secondary mb-1.5">
              API URL
            </label>
            <input
              type="url"
              value={settings.coolifyApiUrl}
              onChange={(e) => setSettings({ ...settings, coolifyApiUrl: e.target.value })}
              placeholder="https://coolify.example.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-content-secondary mb-1.5">
              API Token
            </label>
            <input
              type="password"
              value={settings.coolifyApiToken}
              onChange={(e) => setSettings({ ...settings, coolifyApiToken: e.target.value })}
              placeholder="Bearer token..."
              className={inputClass}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => testConnection("coolify")}
            disabled={testingCoolify || !settings.coolifyApiUrl || !settings.coolifyApiToken}
          >
            {testingCoolify ? "Test ediliyor..." : "🔗 Bağlantı Test Et"}
          </Button>
        </div>
      </Card>

      {/* Save */}
      <Button size="lg" className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Kaydediliyor..." : "💾 Ayarları Kaydet"}
      </Button>
    </div>
  );
}
