'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useState } from 'react';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Get page title based on route
  const getPageTitle = () => {
    if (pathname === '/') return 'Dashboard';
    if (pathname === '/new') return 'Yeni Proje Oluştur';
    if (pathname.startsWith('/runs/')) return 'Pipeline Detayı';
    if (pathname === '/runs') return "Pipeline'lar";
    if (pathname === '/settings') return 'Ayarlar';
    if (pathname === '/admin') return 'Yönetici Paneli';
    if (pathname === '/idea-lab') return 'Idea Lab';
    return 'AI App Factory';
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const highestRole = user?.roles?.[0] || null;

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

          {/* User menu */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 rounded-lg bg-surface-secondary px-3 py-1.5 hover:bg-surface-tertiary transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand to-accent-blue flex items-center justify-center text-white text-xs font-medium">
                  {user.profile.full_name?.[0] || user.email[0].toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-content">
                    {user.profile.full_name || user.email}
                  </div>
                  {highestRole && (
                    <div className="text-xs text-content-muted">
                      {highestRole.name}
                    </div>
                  )}
                </div>
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-lg bg-surface-secondary border border-edge shadow-xl z-20 overflow-hidden">
                    <div className="px-3 py-2 border-b border-edge">
                      <div className="text-sm font-medium text-content">
                        {user.profile.full_name || user.email}
                      </div>
                      <div className="text-xs text-content-muted truncate">
                        {user.email}
                      </div>
                    </div>
                    
                    <div className="p-1">
                      {user.hasRole('super_admin') && (
                        <Link
                          href="/admin"
                          onClick={() => setShowUserMenu(false)}
                          className="block px-3 py-2 text-sm text-content hover:bg-surface-tertiary rounded-lg"
                        >
                          Yönetici Paneli
                        </Link>
                      )}
                      
                      <Link
                        href="/settings"
                        onClick={() => setShowUserMenu(false)}
                        className="block px-3 py-2 text-sm text-content hover:bg-surface-tertiary rounded-lg"
                      >
                        Ayarlar
                      </Link>
                    </div>

                    <div className="border-t border-edge p-1">
                      <button
                        onClick={handleSignOut}
                        className="block w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-surface-tertiary rounded-lg"
                      >
                        Çıkış Yap
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile navigation */}
      <nav className="flex md:hidden border-t border-edge overflow-x-auto">
        {[
          { href: '/', label: 'Dashboard', icon: '📊' },
          { href: '/new', label: 'Yeni Proje', icon: '🚀' },
          { href: '/runs', label: "Pipeline'lar", icon: '⚡' },
          { href: '/idea-lab', label: 'Idea Lab', icon: '💡' },
          ...(user?.hasRole('super_admin') ? [{ href: '/admin', label: 'Yönetici', icon: '👤' }] : []),
        ].map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                isActive
                  ? 'text-brand-hover border-b-2 border-brand'
                  : 'text-content-muted'
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
