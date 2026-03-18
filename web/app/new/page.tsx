"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CategorySelector } from "@/components/new-run/category-selector";
import { IdeaCard } from "@/components/new-run/idea-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { IdeaProposal } from "@/lib/types";

type Step = "category" | "generating" | "review" | "approving" | "started";

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState("productivity");
  const [customCategory, setCustomCategory] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [idea, setIdea] = useState<IdeaProposal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveCategory = useCustom ? customCategory.trim() : category;

  const handleGenerateIdea = async () => {
    if (!effectiveCategory) {
      setError("Kategori seçin veya yazın");
      return;
    }

    setStep("generating");
    setError(null);

    try {
      const res = await fetch("/api/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: effectiveCategory }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Fikir üretilemedi");
        setStep("category");
        return;
      }

      setIdea(data.idea);
      setStep("review");
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
      setStep("category");
    }
  };

  const handleApprove = async () => {
    if (!idea) return;

    setStep("approving");
    setError(null);

    try {
      const res = await fetch("/api/ideas/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, category: effectiveCategory }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Pipeline başlatılamadı");
        setStep("review");
        return;
      }

      setStep("started");
      // Redirect to pipeline detail after short delay
      setTimeout(() => {
        router.push(`/runs/${data.runId}`);
      }, 2000);
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
      setStep("review");
    }
  };

  const handleReject = () => {
    setIdea(null);
    setStep("category");
  };

  const handleRegenerate = async () => {
    setIdea(null);
    await handleGenerateIdea();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page header */}
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-content">
          Yeni Proje Oluştur
        </h1>
        <p className="text-content-secondary mt-2">
          Kategori seçin, AI fikir üretsin, beğenin ve pipeline otomatik başlasın.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 animate-fade-in">
        {[
          { key: "category", label: "Kategori", num: "1" },
          { key: "review", label: "Fikir İnceleme", num: "2" },
          { key: "started", label: "Pipeline", num: "3" },
        ].map((s, i) => {
          const isCompleted =
            (s.key === "category" && step !== "category") ||
            (s.key === "review" && (step === "approving" || step === "started"));
          const isActive =
            (s.key === "category" && (step === "category" || step === "generating")) ||
            (s.key === "review" && (step === "review" || step === "approving")) ||
            (s.key === "started" && step === "started");

          return (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  isCompleted
                    ? "bg-success text-white"
                    : isActive
                    ? "bg-gradient-to-r from-brand to-accent-blue text-white shadow-lg shadow-brand-glow"
                    : "bg-surface-tertiary text-content-muted border border-edge"
                }`}
              >
                {isCompleted ? "✓" : s.num}
              </div>
              <span
                className={`text-sm hidden sm:inline ${
                  isActive ? "text-content font-medium" : "text-content-muted"
                }`}
              >
                {s.label}
              </span>
              {i < 2 && (
                <div
                  className={`flex-1 h-px ${
                    isCompleted ? "bg-success" : "bg-edge"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-danger/10 border border-danger/20 p-4 text-sm text-danger animate-fade-in flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          {error}
        </div>
      )}

      {/* Step 1: Category Selection */}
      {(step === "category" || step === "generating") && (
        <div className="space-y-6 animate-fade-in-scale">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-content mb-4">
              📂 Kategori Seçin
            </h2>
            <CategorySelector
              selected={category}
              onSelect={(c) => { setCategory(c); setUseCustom(false); }}
            />

            <div className="mt-4 flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustom}
                  onChange={(e) => setUseCustom(e.target.checked)}
                  className="rounded border-edge bg-surface-tertiary text-brand"
                />
                <span className="text-sm text-content-secondary">
                  Özel kategori kullan
                </span>
              </label>
            </div>

            {useCustom && (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="kategori-adi (küçük harf, tire)"
                className="mt-3 w-full rounded-xl border border-edge bg-surface-tertiary px-4 py-3 text-sm text-content focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-all placeholder:text-content-muted"
              />
            )}
          </Card>

          <Button
            size="lg"
            className="w-full"
            onClick={handleGenerateIdea}
            disabled={step === "generating" || !effectiveCategory}
          >
            {step === "generating" ? (
              <span className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                AI Fikir Üretiyor...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                Fikir Üret
              </span>
            )}
          </Button>
        </div>
      )}

      {/* Step 2: Review Idea */}
      {(step === "review" || step === "approving") && idea && (
        <div className="space-y-6 animate-slide-up">
          <IdeaCard idea={idea} />

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="flex-1"
              onClick={handleApprove}
              disabled={step === "approving"}
            >
              {step === "approving" ? (
                <span className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Pipeline Hazırlanıyor...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  Onayla & Pipeline Başlat
                </span>
              )}
            </Button>

            <Button
              size="lg"
              variant="secondary"
              onClick={handleRegenerate}
              disabled={step === "approving"}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">🔄</span>
                Yeni Fikir
              </span>
            </Button>

            <Button
              size="lg"
              variant="danger"
              onClick={handleReject}
              disabled={step === "approving"}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">❌</span>
                İptal
              </span>
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Started */}
      {step === "started" && (
        <div className="text-center py-16 animate-fade-in-scale">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-success to-accent-emerald flex items-center justify-center text-4xl mx-auto mb-6 animate-float shadow-lg shadow-green-500/20">
            🚀
          </div>
          <h2 className="text-2xl font-bold text-content mb-2">
            Pipeline Başlatıldı!
          </h2>
          <p className="text-content-secondary">
            Pipeline detay sayfasına yönlendiriliyorsunuz...
          </p>
          <div className="mt-6 flex justify-center">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-brand animate-pulse-dot" style={{ animationDelay: "0s" }} />
              <div className="w-2 h-2 rounded-full bg-brand animate-pulse-dot" style={{ animationDelay: "0.2s" }} />
              <div className="w-2 h-2 rounded-full bg-brand animate-pulse-dot" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
