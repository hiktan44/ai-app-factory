import { Card } from "@/components/ui/card";
import type { RunStats } from "@/lib/types";
import { formatCost } from "@/lib/utils";

interface StatsBarProps {
  stats: RunStats;
}

export function StatsBar({ stats }: StatsBarProps) {
  const items = [
    { label: "Toplam", value: stats.totalRuns.toString(), icon: "\ud83d\udcca" },
    { label: "Ba\u015far\u0131l\u0131", value: stats.successfulRuns.toString(), icon: "\u2705" },
    { label: "Ba\u015far\u0131s\u0131z", value: stats.failedRuns.toString(), icon: "\u274c" },
    { label: "\u00c7al\u0131\u015f\u0131yor", value: stats.runningRuns.toString(), icon: "\u26a1" },
    { label: "Ba\u015far\u0131 Oran\u0131", value: `%${stats.successRate.toFixed(0)}`, icon: "\ud83c\udfaf" },
    { label: "Toplam Maliyet", value: formatCost(stats.totalCostUsd), icon: "\ud83d\udcb0" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {items.map((item) => (
        <Card key={item.label} className="p-3 text-center">
          <div className="text-lg mb-0.5">{item.icon}</div>
          <div className="text-lg font-bold text-[var(--color-text-primary)]">
            {item.value}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {item.label}
          </div>
        </Card>
      ))}
    </div>
  );
}
