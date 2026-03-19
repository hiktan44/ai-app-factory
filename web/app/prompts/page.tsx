"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PromptData {
  content: string;
  label: string;
  description: string;
  llm: string;
}

type PromptsMap = Record<string, PromptData>;

const LLM_COLORS: Record<string, string> = {
  "Claude": "text-orange-400",
  "Gemini": "text-blue-400",
  "Gemini/Grok": "text-blue-400",
  "Qwen/Gemini": "text-green-400",
};

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptsMap>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((data: PromptsMap) => {
        setPrompts(data);
        const first = Object.keys(data)[0];
        if (first) {
          setSelected(first);
          setEditContent(data[first].content);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (name: string) => {
    setSelected(name);
    setEditContent(prompts[name]?.content || "");
    setMessage(null);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selected, content: editContent }),
      });
      if (res.ok) {
        setPrompts((prev) => ({
          ...prev,
          [selected]: { ...prev[selected], content: editContent },
        }));
        setMessage({ type: "success", text: "Prompt kaydedildi!" });
      } else {
        setMessage({ type: "error", text: "Kaydetme başarısız" });
      }
    } catch {
      setMessage({ type: "error", text: "Bağlantı hatası" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (selected && prompts[selected]) {
      setEditContent(prompts[selected].content);
      setMessage(null);
    }
  };

  const hasChanges = selected && editContent !== (prompts[selected]?.content || "");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-content-muted animate-pulse">Promptlar yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-3xl font-bold text-content">📝 Prompt Editörü</h1>
        <p className="text-content-secondary mt-2">
          Pipeline adımlarının sistem promptlarını düzenleyin. Her adımda hangi AI kullanıldığı gösterilir.
        </p>
      </div>

      {message && (
        <div className={`mb-4 rounded-xl border p-3 text-sm animate-fade-in ${
          message.type === "success" ? "bg-success/10 border-success/20 text-success" : "bg-danger/10 border-danger/20 text-danger"
        }`}>
          {message.type === "success" ? "✅" : "❌"} {message.text}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="col-span-4">
          <Card className="p-3">
            <div className="space-y-1">
              {Object.entries(prompts).map(([name, data]) => (
                <button
                  key={name}
                  onClick={() => handleSelect(name)}
                  className={`w-full text-left px-3 py-3 rounded-lg transition-all ${
                    selected === name
                      ? "bg-brand/10 border border-brand/20"
                      : "hover:bg-surface-secondary border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-content">{data.label}</span>
                    <span className={`text-xs font-mono ${LLM_COLORS[data.llm] || "text-content-muted"}`}>
                      {data.llm}
                    </span>
                  </div>
                  <p className="text-xs text-content-muted mt-0.5">{data.description}</p>
                  <p className="text-xs text-content-muted mt-1">
                    {data.content ? `${data.content.length} karakter` : "⚠️ Boş"}
                  </p>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Editor */}
        <div className="col-span-8">
          {selected && prompts[selected] && (
            <Card className="p-5 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-content">{prompts[selected].label}</h3>
                  <p className="text-xs text-content-muted mt-0.5">
                    AI: <span className={LLM_COLORS[prompts[selected].llm] || "text-content-muted"}>
                      {prompts[selected].llm}
                    </span>
                    {" "}· {editContent.length} karakter
                  </p>
                </div>
                <div className="flex gap-2">
                  {hasChanges && (
                    <Button variant="secondary" size="sm" onClick={handleReset}>
                      ↩️ Geri Al
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                  >
                    {saving ? "Kaydediliyor..." : "💾 Kaydet"}
                  </Button>
                </div>
              </div>

              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={28}
                className="w-full rounded-xl border border-edge bg-surface-tertiary px-4 py-3 text-xs text-content font-mono focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-all resize-none leading-relaxed"
                placeholder="Prompt içeriği..."
                spellCheck={false}
              />

              <div className="mt-3 p-3 rounded-lg bg-surface-secondary border border-edge">
                <p className="text-xs text-content-muted">
                  💡 <strong>İpucu:</strong> Bu adım <strong>{prompts[selected].llm}</strong> ile çalışır.
                  {prompts[selected].llm.includes("Gemini") && " Gemini Flash ücretsizdir, araştırma adımları için uygundur."}
                  {prompts[selected].llm === "Claude" && " Claude kritik kod yazma ve mimari görevler için kullanılır."}
                  {prompts[selected].llm.includes("Qwen") && " Qwen çok dilli marketing içeriği için uygundur."}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
