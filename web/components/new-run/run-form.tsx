"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategorySelector } from "./category-selector";

export function RunForm() {
  const router = useRouter();
  const [category, setCategory] = useState("productivity");
  const [customCategory, setCustomCategory] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveCategory = useCustom ? customCategory : category;

  const handleSubmit = async () => {
    if (!effectiveCategory.trim()) {
      setError("Kategori se\u00e7in veya yaz\u0131n");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: effectiveCategory.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Pipeline ba\u015flat\u0131lamad\u0131");
        return;
      }

      router.push(`/runs/${data.runId}`);
    } catch (err) {
      setError("Ba\u011flant\u0131 hatas\u0131. Tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
          Kategori Se\u00e7in
        </h2>
        <CategorySelector selected={category} onSelect={(c) => { setCategory(c); setUseCustom(false); }} />

        <div className="mt-4 flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              className="rounded border-[var(--color-border)]"
            />
            <span className="text-sm text-[var(--color-text-secondary)]">
              \u00d6zel kategori kullan
            </span>
          </label>
        </div>

        {useCustom && (
          <input
            type="text"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder="kategori-adi (k\u00fc\u00e7\u00fck harf, tire)"
            className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        )}
      </Card>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <Button
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        disabled={loading || !effectiveCategory.trim()}
      >
        {loading ? (
          <>
            <span className="animate-spin">&#9696;</span>
            Ba\u015flat\u0131l\u0131yor...
          </>
        ) : (
          <>
            \ud83d\ude80 Pipeline Ba\u015flat
          </>
        )}
      </Button>
    </div>
  );
}
