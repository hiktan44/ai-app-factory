"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();

  // Get page title based on route
  const getPageTitle = () => {
    if (pathname === "/") return "Dashboard";
    if (pathname === "/new") return "Yeni Proje Oluştur";
    if (pathname.startsWith("/runs/")) return "Pipeline Detayı";
    if (pathname === "/runs") return "Pipeline'lar";
    if (pathname === "/settings") return "Ayarlar";
    return "AI App Factory";
  };

  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-surface/80 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between px-4 md:px-8">
        {/* Mobile logo */}
        <div className="flex items-center gap-3 md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-accent-blue flex items-center justify-center text-white text-sm">
              🏭
            </div>
            <span className="font-bold text-sm text-content">
              AI App Factory
            </span>
          </Link>
        </div>

        {/* Page title */}
        <h2 className="hidden md:block text-sm font-medium text-content-secondary">
          {getPageTitle()}
        </h2>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/new"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand to-accent-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-all shadow-lg shadow-brand-glow hover:shadow-xl hover:shadow-brand-glow"
          >
            <span className="text-base">✨</span>
            Yeni Proje
          </Link>
        </div>
      </div>

      {/* Mobile navigation */}
      <nav className="flex md:hidden border-t border-edge overflow-x-auto">
        {[
          { href: "/", label: "Dashboard", icon: "📊" },
          { href: "/new", label: "Yeni Proje", icon: "🚀" },
          { href: "/runs", label: "Pipeline'lar", icon: "⚡" },
          { href: "/settings", label: "Ayarlar", icon: "⚙️" },
        ].map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                isActive
                  ? "text-brand-hover border-b-2 border-brand"
                  : "text-content-muted"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
