export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}dk ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}sa ${m}dk`;
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export function extractCategoryFromRunId(runId: string): string {
  // Format: category_YYYYMMDD_HHMMSS
  const parts = runId.split("_");
  if (parts.length >= 3) {
    // Remove last 2 parts (date + time)
    return parts.slice(0, -2).join("_");
  }
  return runId;
}

export function extractTimestampFromRunId(runId: string): string {
  // Format: category_YYYYMMDD_HHMMSS
  const parts = runId.split("_");
  if (parts.length >= 3) {
    const date = parts[parts.length - 2];
    const time = parts[parts.length - 1];
    // YYYYMMDD_HHMMSS -> YYYY-MM-DD HH:MM:SS
    const y = date.substring(0, 4);
    const mo = date.substring(4, 6);
    const d = date.substring(6, 8);
    const h = time.substring(0, 2);
    const mi = time.substring(2, 4);
    const s = time.substring(4, 6);
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  }
  return "";
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    queued: "Kuyrukta",
    running: "\u00c7al\u0131\u015f\u0131yor",
    completed: "Tamamland\u0131",
    failed: "Ba\u015far\u0131s\u0131z",
    stopped: "Durduruldu",
  };
  return labels[status] || status;
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    productivity: "\u00dcretkenlik",
    "developer-tools": "Geli\u015ftirici Ara\u00e7lar\u0131",
    health: "Sa\u011fl\u0131k",
    finance: "Finans",
    education: "E\u011fitim",
    social: "Sosyal",
    "e-commerce": "E-Ticaret",
    ai: "Yapay Zeka",
  };
  return labels[category] || category;
}
