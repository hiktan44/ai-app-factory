"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊", description: "Genel bakış" },
  { href: "/idea-lab", label: "Idea Lab", icon: "💡", description: "Fikir araştır & geliştir" },
  { href: "/new", label: "Yeni Proje", icon: "🚀", description: "Kategoriden başlat" },
  { href: "/runs", label: "Pipeline'lar", icon: "⚡", description: "Tüm çalıştırmalar" },
  { href: "/prompts", label: "Promptlar", icon: "📝", description: "Prompt editörü" },
  { href: "/settings", label: "Ayarlar", icon: "⚙️", description: "API & Deploy" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-edge bg-surface-secondary hidden md:flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-edge">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-accent-blue flex items-center justify-center text-white text-lg shadow-lg shadow-brand-glow">
          🏭
        </div>
        <div>
          <h1 className="font-bold text-content text-sm tracking-tight">
            AI App Factory
          </h1>
          <p className="text-[10px] text-content-muted">
            Otonom Üretim Bandı
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group",
                isActive
                  ? "bg-brand-subtle text-brand-hover border border-brand/20"
                  : "text-content-secondary hover:bg-surface-hover hover:text-content"
              )}
            >
              <span className="text-lg">{item.icon}</span>
              <div>
                <div className="font-medium">{item.label}</div>
                <div className={cn(
                  "text-[10px] leading-tight",
                  isActive ? "text-brand-hover/60" : "text-content-muted"
                )}>
                  {item.description}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-edge">
        <div className="flex items-center gap-2 text-xs text-content-muted">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse-dot" />
          Sistem Aktif
        </div>
        <p className="text-[10px] text-content-faint mt-1">
          v2.0 — Antigravity Powered
        </p>
      </div>
    </aside>
  );
}
