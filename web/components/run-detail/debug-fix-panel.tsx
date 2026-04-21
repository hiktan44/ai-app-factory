"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DebugFixPanelProps {
  runId: string;
  isCompleted: boolean;
  isFailed?: boolean;
}

interface FixResult {
  success: boolean;
  action: string;
  analysis?: string;
  appliedFixes?: string[];
  commands?: string[];
  error?: string;
  details?: string;
  // run-dev specific
  appDir?: string;
  needsInstall?: boolean;
  instructions?: string;
  message?: string;
}

export function DebugFixPanel({ runId, isCompleted, isFailed }: DebugFixPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [issue, setIssue] = useState("");
  const [filePath, setFilePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FixResult | null>(null);
  const [activeAction, setActiveAction] = useState<string>("");

  const handleAction = useCallback(
    async (action: "analyze" | "fix" | "run-dev") => {
      // For analyze/fix: use custom issue or default to auto-detect
      const issueText = issue.trim() || (isFailed ? "Build başarısız olmuş. Hatanın nedenini bul ve çözüm öner." : "Uygulamayı analiz et.");

      if (action === "run-dev" && !issueText) return;
      setLoading(true);
      setActiveAction(action);
      setResult(null);

      try {
        const res = await fetch(`/api/runs/${runId}/debug-fix`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issue: issueText,
            filePath: filePath.trim() || undefined,
            action,
          }),
        });
        const data = await res.json();
        setResult(data);
      } catch (err) {
        setResult({
          success: false,
          action,
          error: "Bağlantı hatası",
          details: String(err),
        });
      } finally {
        setLoading(false);
        setActiveAction("");
      }
    },
    [runId, issue, filePath, isFailed],
  );

  // Show for both completed and failed runs
  if (!isCompleted && !isFailed) return null;

  return (
    <div className="space-y-4">
      {/* Action buttons row */}
      <div className="flex items-center gap-3">
        <Button
          variant={isOpen ? "primary" : "secondary"}
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? "✕ Kapat" : "🔧 Hata Düzelt / Debug"}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={() => handleAction("run-dev")}
        >
          {activeAction === "run-dev" ? "⏳ Kontrol..." : "▶ Uygulamayı Çalıştır"}
        </Button>
      </div>

      {/* Run-dev result */}
      {result?.action === "run-dev" && (
        <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
          {result.success ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-emerald-400">
                {result.message}
              </p>
              <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-emerald-300">
                {result.instructions}
              </div>
              <p className="text-xs text-content-muted">
                Bu komutu terminal&apos;de çalıştırarak uygulamayı başlatabilirsiniz.
              </p>
            </div>
          ) : (
            <p className="text-sm text-danger">{result.error}</p>
          )}
        </Card>
      )}

      {/* Debug/Fix panel */}
      {isOpen && (
        <Card className="p-5 border-brand/20 bg-brand/5">
          <h3 className="text-sm font-semibold text-content mb-1">
            {isFailed ? "Hata Analizi" : "Sorunu Açıkla"}
          </h3>
          <p className="text-xs text-content-muted mb-4">
            {isFailed
              ? "Boş bırakırsan otomatik analiz yapar. İstersen sorunu detaylandır."
              : "Uygulamada neyin çalışmadığını açıkla. Claude analiz edip düzeltecek."}
          </p>

          <div className="space-y-3">
            <textarea
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder={isFailed
                ? "Opsiyonel: Ek detay ekle veya direkt 'Analiz Et' butonuna bas..."
                : "Örn: Login sayfası 404 veriyor, dashboard yüklenmiyor, API endpoint çalışmıyor..."}
              className="w-full p-3 bg-surface-tertiary rounded-xl text-sm text-content border border-edge focus:border-brand focus:ring-1 focus:ring-brand outline-none resize-none transition-colors"
              rows={3}
            />

            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="Opsiyonel: dosya yolu (ör: app/page.tsx)"
              className="w-full p-3 bg-surface-tertiary rounded-xl text-sm text-content border border-edge focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-colors"
            />

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={loading}
                onClick={() => handleAction("analyze")}
              >
                {activeAction === "analyze" ? "⏳ Analiz Ediliyor..." : "🔍 Analiz Et"}
              </Button>

              <Button
                variant="primary"
                size="sm"
                disabled={loading}
                onClick={() => handleAction("fix")}
              >
                {activeAction === "fix" ? "⏳ Düzeltiliyor..." : "🔧 Analiz Et ve Düzelt"}
              </Button>
            </div>
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="mt-4 flex items-center gap-3 text-sm text-content-muted">
              <div className="w-4 h-4 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
              <span>
                {activeAction === "analyze"
                  ? "Claude kodu analiz ediyor..."
                  : "Claude kodu analiz edip düzeltiyor..."}
              </span>
            </div>
          )}

          {/* Results */}
          {result && result.action !== "run-dev" && (
            <div className="mt-4 space-y-3">
              {result.error ? (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl">
                  <p className="text-sm text-danger font-medium">Hata</p>
                  <p className="text-xs text-danger/80 mt-1">{result.error}</p>
                  {result.details && (
                    <p className="text-xs text-content-muted mt-1 font-mono">
                      {result.details}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* Applied fixes */}
                  {result.appliedFixes && result.appliedFixes.length > 0 && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <p className="text-sm text-emerald-400 font-medium mb-2">
                        Uygulanan Düzeltmeler
                      </p>
                      {result.appliedFixes.map((fix, i) => (
                        <p
                          key={i}
                          className="text-xs text-emerald-300/80 font-mono"
                        >
                          {fix}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Commands to run */}
                  {result.commands && result.commands.length > 0 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <p className="text-sm text-amber-400 font-medium mb-2">
                        Çalıştırılacak Komutlar
                      </p>
                      {result.commands.map((cmd, i) => (
                        <p
                          key={i}
                          className="text-xs text-amber-300/80 font-mono bg-black/30 p-1.5 rounded mt-1"
                        >
                          $ {cmd}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Analysis */}
                  {result.analysis && (
                    <div className="p-3 bg-surface-tertiary border border-edge rounded-xl">
                      <p className="text-sm text-content font-medium mb-2">
                        Analiz Raporu
                      </p>
                      <div className="text-xs text-content-secondary whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                        {result.analysis}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
