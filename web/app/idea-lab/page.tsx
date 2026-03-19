"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/constants";
import type { EnhancedIdea, ResearchResult } from "@/lib/idea-researcher";

type Step = "input" | "researching" | "reviewing" | "editing" | "launching";

interface EnhanceResponse {
  enhanced: EnhancedIdea;
  research: ResearchResult;
}

export default function IdeaLabPage() {
  const [step, setStep] = useState<Step>("input");
  const [idea, setIdea] = useState("");
  const [category, setCategory] = useState("productivity");
  const [enhanced, setEnhanced] = useState<EnhancedIdea | null>(null);
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [editedIdea, setEditedIdea] = useState<EnhancedIdea | null>(null);
  const [error, setError] = useState("");
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<{ runId: string } | null>(null);

  const handleResearch = async () => {
    if (!idea.trim()) return;
    setStep("researching");
    setError("");

    try {
      const res = await fetch("/api/ideas/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim(), category }),
      });

      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error || "Hata oluştu");
      }

      const data = await res.json() as EnhanceResponse;
      setEnhanced(data.enhanced);
      setEditedIdea(data.enhanced);
      setResearch(data.research);
      setStep("reviewing");
    } catch (e) {
      setError(String(e));
      setStep("input");
    }
  };

  const handleEdit = () => {
    setStep("editing");
  };

  const handleApprove = async () => {
    if (!editedIdea) return;
    setLaunching(true);

    try {
      // Product spec oluştur
      const productSpec = buildProductSpec(editedIdea, research);

      // Pipeline'ı başlat (pre-approved spec ile)
      const res = await fetch("/api/runs/with-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          productSpec,
          appName: editedIdea.appName,
        }),
      });

      if (!res.ok) throw new Error("Pipeline başlatılamadı");

      const data = await res.json() as { runId: string };
      setLaunchResult(data);
      setStep("launching");
    } catch (e) {
      setError(String(e));
    } finally {
      setLaunching(false);
    }
  };

  const updateField = (field: keyof EnhancedIdea, value: string | string[]) => {
    setEditedIdea((prev) => prev ? { ...prev, [field]: value } : null);
  };

  const inputClass = "w-full rounded-xl border border-edge bg-surface-tertiary px-4 py-3 text-sm text-content focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-all placeholder:text-content-muted";
  const textareaClass = inputClass + " resize-none";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold">
          <span className="gradient-text">💡 Idea Lab</span>
        </h1>
        <p className="text-content-secondary mt-2">
          Fikrinizi yazın → AI araştırsın → GitHub/HuggingFace trendlerini analiz etsin → Geliştirilmiş versiyonu önersin → Onaylayın → Pipeline başlasın
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger">
          ❌ {error}
        </div>
      )}

      {/* ─── STEP 1: Input ─────────────────────────────── */}
      {step === "input" && (
        <Card className="p-6 animate-fade-in">
          <h2 className="text-lg font-semibold text-content mb-4">🚀 Fikrinizi Anlatın</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-content-secondary mb-1.5">Fikriniz</label>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={4}
                placeholder="Örnek: Freelancer'lar için zaman takibi ve fatura oluşturma aracı. Projeler bazında saat takibi yapıp otomatik PDF fatura üretsin..."
                className={textareaClass}
              />
            </div>

            <div>
              <label className="block text-sm text-content-secondary mb-1.5">Kategori</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <Button size="lg" className="w-full" onClick={handleResearch} disabled={!idea.trim()}>
              <span className="text-lg">🔍</span> Araştır ve Geliştir
            </Button>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-surface-secondary border border-edge">
            <p className="text-xs text-content-muted font-medium mb-2">AI şunları yapacak:</p>
            <ul className="text-xs text-content-secondary space-y-1">
              <li>📊 GitHub Trending'deki ilgili projeleri analiz eder</li>
              <li>🤗 HuggingFace'deki benzer AI uygulamalarını inceler</li>
              <li>🔍 Rakipleri ve pazar boşluklarını değerlendirir</li>
              <li>✨ Fikrinizi detaylandırır ve benzersiz değer önerisi ekler</li>
              <li>📝 Teknik stack ve MVP kapsamını belirler</li>
            </ul>
          </div>
        </Card>
      )}

      {/* ─── STEP 2: Researching ─────────────────────────── */}
      {step === "researching" && (
        <Card className="p-8 animate-fade-in text-center">
          <div className="text-5xl mb-4 animate-bounce">🔍</div>
          <h2 className="text-xl font-semibold text-content mb-2">Araştırılıyor...</h2>
          <p className="text-content-secondary text-sm mb-6">
            GitHub trending, HuggingFace ve pazar verileri analiz ediliyor
          </p>
          <div className="space-y-2 text-left max-w-sm mx-auto">
            {["GitHub Trending analiz ediliyor...", "HuggingFace Spaces inceleniyor...", "Benzer projeler değerlendiriliyor...", "Fikir geliştiriliyor..."].map((text, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-content-muted">
                <span className="animate-spin">⏳</span> {text}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ─── STEP 3: Review ─────────────────────────────── */}
      {(step === "reviewing" || step === "editing") && enhanced && editedIdea && (
        <div className="space-y-6 animate-fade-in">

          {/* Research Summary */}
          {research && (
            <Card className="p-5 border-blue-500/20 bg-blue-500/5">
              <h3 className="font-semibold text-content mb-3">📊 Araştırma Özeti</h3>
              <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div>
                  <div className="text-2xl font-bold text-brand">{research.githubTrending.length}</div>
                  <div className="text-xs text-content-muted">GitHub Trending</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-brand">{research.relatedRepos.length}</div>
                  <div className="text-xs text-content-muted">İlgili Proje</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-brand">{research.huggingFaceSpaces.length}</div>
                  <div className="text-xs text-content-muted">HF Spaces</div>
                </div>
              </div>
              {research.insights.length > 0 && (
                <ul className="text-xs text-content-secondary space-y-1">
                  {research.insights.map((insight, i) => (
                    <li key={i} className="flex gap-2"><span>💡</span>{insight}</li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* Enhanced Idea */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-content">✨ Geliştirilen Fikir</h3>
              {step === "reviewing" && (
                <Button variant="secondary" size="sm" onClick={handleEdit}>✏️ Düzenle</Button>
              )}
            </div>

            {step === "reviewing" ? (
              // Read-only view
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-content">{editedIdea.appName}</h2>
                    <p className="text-brand font-medium mt-1">{editedIdea.tagline}</p>
                  </div>
                </div>

                <p className="text-sm text-content-secondary leading-relaxed">{editedIdea.enhancedIdea}</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-content-muted font-medium mb-2">🎯 Hedef Kitle</p>
                    <p className="text-sm text-content-secondary">{editedIdea.targetAudience}</p>
                  </div>
                  <div>
                    <p className="text-xs text-content-muted font-medium mb-2">💰 Gelir Modeli</p>
                    <p className="text-sm text-content-secondary">{editedIdea.monetizationStrategy}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-content-muted font-medium mb-2">⭐ Benzersiz Değer Önerisi</p>
                  <p className="text-sm text-content-secondary">{editedIdea.uniqueValueProp}</p>
                </div>

                <div>
                  <p className="text-xs text-content-muted font-medium mb-2">✅ Temel Özellikler</p>
                  <ul className="space-y-1">
                    {editedIdea.keyFeatures.map((f, i) => (
                      <li key={i} className="text-sm text-content-secondary flex gap-2">
                        <span className="text-success">•</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-xs text-content-muted font-medium mb-2">🔧 Teknoloji Stack</p>
                  <div className="flex flex-wrap gap-2">
                    {editedIdea.techStack.map((t, i) => (
                      <span key={i} className="px-2 py-1 rounded-lg bg-surface-secondary text-xs text-content-secondary border border-edge">{t}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-content-muted font-medium mb-2">📦 MVP Kapsamı</p>
                  <p className="text-sm text-content-secondary">{editedIdea.mvpScope}</p>
                </div>
              </div>
            ) : (
              // Edit mode
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-content-secondary mb-1">Uygulama Adı</label>
                  <input type="text" value={editedIdea.appName} onChange={(e) => updateField("appName", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-content-secondary mb-1">Slogan</label>
                  <input type="text" value={editedIdea.tagline} onChange={(e) => updateField("tagline", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-content-secondary mb-1">Fikir Açıklaması</label>
                  <textarea rows={4} value={editedIdea.enhancedIdea} onChange={(e) => updateField("enhancedIdea", e.target.value)} className={textareaClass} />
                </div>
                <div>
                  <label className="block text-sm text-content-secondary mb-1">Hedef Kitle</label>
                  <input type="text" value={editedIdea.targetAudience} onChange={(e) => updateField("targetAudience", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-content-secondary mb-1">Benzersiz Değer Önerisi</label>
                  <textarea rows={2} value={editedIdea.uniqueValueProp} onChange={(e) => updateField("uniqueValueProp", e.target.value)} className={textareaClass} />
                </div>
                <div>
                  <label className="block text-sm text-content-secondary mb-1">MVP Kapsamı</label>
                  <textarea rows={3} value={editedIdea.mvpScope} onChange={(e) => updateField("mvpScope", e.target.value)} className={textareaClass} />
                </div>
                <Button variant="secondary" onClick={() => setStep("reviewing")}>✓ Düzenlemeyi Bitir</Button>
              </div>
            )}
          </Card>

          {/* Action Buttons */}
          {step === "reviewing" && (
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setStep("input")}>
                ← Geri Dön
              </Button>
              <Button size="lg" className="flex-1" onClick={handleApprove} disabled={launching}>
                {launching ? "🚀 Başlatılıyor..." : "🚀 Onayla ve Pipeline Başlat"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── STEP 4: Launched ─────────────────────────────── */}
      {step === "launching" && launchResult && (
        <Card className="p-8 text-center animate-fade-in">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-semibold text-content mb-2">Pipeline Başlatıldı!</h2>
          <p className="text-content-secondary text-sm mb-4">
            10 adımlı AI pipeline&apos;ı çalışmaya başladı. Fikriniz bir uygulamaya dönüşüyor.
          </p>
          <p className="text-xs text-content-muted mb-6">Run ID: <code className="font-mono">{launchResult.runId}</code></p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => { setStep("input"); setIdea(""); setEnhanced(null); }}>
              💡 Yeni Fikir
            </Button>
            <a href={`/runs/${launchResult.runId}`}>
              <Button>📊 Pipeline&apos;ı İzle →</Button>
            </a>
          </div>
        </Card>
      )}

      {/* Trending Sidebar Hint */}
      {step === "input" && (
        <Card className="p-5 border-brand/10 animate-fade-in">
          <h3 className="text-sm font-semibold text-content mb-3">🔥 Bu Hafta Trend Fikirler</h3>
          <p className="text-xs text-content-muted">
            Fikrinizi yazdıktan sonra AI, GitHub&apos;daki yıldız alan projeler ve HuggingFace Spaces&apos;teki trend uygulamalarla karşılaştırıp en iyi versiyonu önerecek.
          </p>
        </Card>
      )}
    </div>
  );
}

function buildProductSpec(idea: EnhancedIdea, research: ResearchResult | null): string {
  const lines = [
    `# ${idea.appName}`,
    ``,
    `## Tagline`,
    `${idea.tagline}`,
    ``,
    `## Fikir`,
    `${idea.enhancedIdea}`,
    ``,
    `## Hedef Kitle`,
    `${idea.targetAudience}`,
    ``,
    `## Benzersiz Değer Önerisi`,
    `${idea.uniqueValueProp}`,
    ``,
    `## Temel Özellikler`,
    ...idea.keyFeatures.map((f) => `- ${f}`),
    ``,
    `## Teknoloji Stack`,
    ...idea.techStack.map((t) => `- ${t}`),
    ``,
    `## Gelir Modeli`,
    `${idea.monetizationStrategy}`,
    ``,
    `## MVP Kapsamı`,
    `${idea.mvpScope}`,
    ``,
    `## Rakip Analizi`,
    `${idea.competitorAnalysis}`,
  ];

  if (research) {
    lines.push(``, `## Pazar Araştırması`);
    research.insights.forEach((i) => lines.push(`- ${i}`));

    if (research.relatedRepos.length > 0) {
      lines.push(``, `### İlgili GitHub Projeleri`);
      research.relatedRepos.slice(0, 5).forEach((r) => {
        lines.push(`- **${r.name}** (${r.stars}⭐): ${r.description}`);
      });
    }
  }

  return lines.join("\n");
}
