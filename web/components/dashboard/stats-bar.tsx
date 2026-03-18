import { Card } from "@/components/ui/card";
import type { RunStats } from "@/lib/types";
import { formatCost } from "@/lib/utils";

interface StatsBarProps {
  stats: RunStats;
}

const statConfig = [
  { key: "totalRuns", label: "Toplam", icon: "📊", gradient: "from-blue-500/20 to-cyan-500/20" },
  { key: "successfulRuns", label: "Başarılı", icon: "✅", gradient: "from-green-500/20 to-emerald-500/20" },
  { key: "failedRuns", label: "Başarısız", icon: "❌", gradient: "from-red-500/20 to-rose-500/20" },
  { key: "runningRuns", label: "Çalışıyor", icon: "⚡", gradient: "from-amber-500/20 to-yellow-500/20" },
  { key: "successRate", label: "Başarı Oranı", icon: "🎯", gradient: "from-violet-500/20 to-purple-500/20" },
  { key: "totalCostUsd", label: "Toplam Maliyet", icon: "💰", gradient: "from-emerald-500/20 to-teal-500/20" },
] as const;

export function StatsBar({ stats }: StatsBarProps) {
  const getValue = (key: string): string => {
    switch (key) {
      case "totalRuns": return stats.totalRuns.toString();
      case "successfulRuns": return stats.successfulRuns.toString();
      case "failedRuns": return stats.failedRuns.toString();
      case "runningRuns": return stats.runningRuns.toString();
      case "successRate": return `%${stats.successRate.toFixed(0)}`;
      case "totalCostUsd": return formatCost(stats.totalCostUsd);
      default: return "0";
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-fade-in">
      {statConfig.map((item) => (
        <Card key={item.key} className="p-4 text-center relative overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-50`} />
          <div className="relative">
            <div className="text-xl mb-1">{item.icon}</div>
            <div className="text-xl font-bold text-content font-mono">
              {getValue(item.key)}
            </div>
            <div className="text-[10px] text-content-muted mt-0.5">
              {item.label}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
