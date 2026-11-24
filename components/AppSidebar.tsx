'use client';

/**
 * @file components/AppSidebar.tsx
 * @description Clean 3-line hamburger navigation sidebar rendered via React Portal with active user identity and sign-out action.
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  X,
  LayoutDashboard,
  PieChart,
  CalendarRange,
  Repeat,
  TrendingUp,
  Receipt,
  ShieldCheck,
  ShieldAlert,
  Settings,
  LogOut,
} from 'lucide-react';

interface AppSidebarProps {
  darkMode?: boolean;
}

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Dashboard',
    subtitle: 'Safe cash, wallets & daily activity',
    icon: LayoutDashboard,
  },
  {
    href: '/planning',
    label: 'Budgets & Loans',
    subtitle: 'Spending limits, loans & goals',
    icon: PieChart,
  },
  {
    href: '/insights',
    label: 'Calendar & Reports',
    subtitle: 'Forecasts, timeline & cash analytics',
    icon: CalendarRange,
  },
  {
    href: '/subscriptions',
    label: 'Subscriptions',
    subtitle: 'Recurring bills & renewal reminders',
    icon: Repeat,
  },
  {
    href: '/split',
    label: 'Bill Splitting',
    subtitle: 'Shared bills, itemized splits & settlements',
    icon: Receipt,
  },
  {
    href: '/reserved',
    label: 'Reserved & Goals',
    subtitle: 'Protected funds & savings vaults',
    icon: ShieldCheck,
  },
  {
    href: '/wealth',
    label: 'Wealth',
    subtitle: 'Investments & non-liquid net worth',
    icon: TrendingUp,
  },
  {
    href: '/settings',
    label: 'Settings',
    subtitle: 'Currency, profile & workspace preferences',
    icon: Settings,
  },
];

export default function AppSidebar({ darkMode = false }: AppSidebarProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; isAdmin?: boolean } | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem('pocketq_dashboard_cache');
      sessionStorage.removeItem('pocketq_splits_cache');
    } catch {}
    await fetch('/api/auth/logout', { method: 'POST' });
    setOpen(false);
    router.push('/login');
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        title="Workspaces"
        style={
          darkMode
            ? {
                backgroundColor: 'rgba(16, 42, 34, 0.22)',
                backgroundImage: 'linear-gradient(135deg, rgba(62, 232, 149, 0.08) 0%, rgba(18, 72, 92, 0.06) 100%)',
                backdropFilter: 'blur(18px) saturate(160%)',
                WebkitBackdropFilter: 'blur(18px) saturate(160%)',
                borderColor: 'rgba(179, 239, 178, 0.16)',
                boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
              }
            : {
                backgroundColor: 'rgba(255, 255, 255, 0.32)',
                backdropFilter: 'blur(18px) saturate(180%)',
                WebkitBackdropFilter: 'blur(18px) saturate(180%)',
                borderColor: 'rgba(255, 255, 255, 0.55)',
                boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.7)',
              }
        }
        className={`inline-flex items-center justify-center p-2 rounded-xl border transition cursor-pointer ${
          darkMode
            ? 'text-[#E8F1F2] hover:bg-white/10'
            : 'text-[#001A23] hover:bg-white/50'
        }`}
      >
        <Menu className="w-4 h-4" />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex">
            <div
              onClick={() => setOpen(false)}
              className={`fixed inset-0 transition-opacity ${
                darkMode ? 'bg-black/30' : 'bg-[#001A23]/10'
              }`}
            />

            <aside
              style={
                darkMode
                  ? {
                      backgroundColor: 'rgba(6, 12, 14, 0.42)',
                      backgroundImage:
                        'radial-gradient(circle at 12% 14%, rgba(26, 92, 68, 0.36) 0%, transparent 48%), radial-gradient(circle at 86% 18%, rgba(18, 72, 92, 0.32) 0%, transparent 50%), radial-gradient(circle at 78% 85%, rgba(130, 32, 82, 0.22) 0%, transparent 50%)',
                      backdropFilter: 'blur(28px) saturate(170%)',
                      WebkitBackdropFilter: 'blur(28px) saturate(170%)',
                      borderRight: '1px solid rgba(255, 255, 255, 0.16)',
                      boxShadow: '16px 0 48px rgba(0, 0, 0, 0.55)',
                    }
                  : {
                      backgroundColor: 'rgba(232, 241, 242, 0.45)',
                      backgroundImage:
                        'radial-gradient(at 10% 10%, rgba(164, 214, 198, 0.52) 0px, transparent 52%), radial-gradient(at 88% 12%, rgba(182, 224, 242, 0.62) 0px, transparent 54%), radial-gradient(at 82% 86%, rgba(168, 226, 196, 0.45) 0px, transparent 54%), radial-gradient(at 14% 86%, rgba(192, 218, 238, 0.55) 0px, transparent 54%)',
                      backdropFilter: 'blur(28px) saturate(185%)',
                      WebkitBackdropFilter: 'blur(28px) saturate(185%)',
                      borderRight: '1px solid rgba(255, 255, 255, 0.72)',
                      boxShadow: 'inset -1px 0 0 0 rgba(255, 255, 255, 0.85), 16px 0 44px rgba(0, 26, 35, 0.12)',
                    }
              }
              className={`relative z-10 w-76 max-w-[84vw] h-dvh flex flex-col justify-between p-5 overflow-y-auto ${
                darkMode ? 'text-[#E8F1F2]' : 'text-[#001A23]'
              }`}
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-[#7A9E7E]/15">
                  <div>
                    <span className="font-extrabold text-base tracking-tight block">
                      PocketQ
                    </span>
                    <span className="text-[11px] opacity-65">
                      Personal Finance Workspaces
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close navigation menu"
                    className="p-1.5 rounded-xl hover:bg-[#7A9E7E]/15 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <nav className="space-y-1.5">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-start gap-3 p-3 rounded-2xl transition ${
                          isActive
                            ? 'bg-[#31493C] text-[#B3EFB2] shadow-xs'
                            : darkMode
                            ? 'hover:bg-[#31493C]/40'
                            : 'hover:bg-white/80'
                        }`}
                      >
                        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-bold block leading-snug">
                            {item.label}
                          </span>
                          <span
                            className={`text-[11px] block leading-tight mt-0.5 ${
                              isActive ? 'text-[#E8F1F2]/80' : 'opacity-65'
                            }`}
                          >
                            {item.subtitle}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                  {user?.isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className={`flex items-start gap-3 p-3 rounded-2xl transition border ${
                        pathname === '/admin'
                          ? 'bg-[#D52073] text-white border-[#D52073] shadow-xs'
                          : 'border-[#D52073]/30 text-[#D52073] hover:bg-[#D52073]/10'
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs font-bold block leading-snug">
                          Admin Portal
                        </span>
                        <span
                          className={`text-[11px] block leading-tight mt-0.5 ${
                            pathname === '/admin' ? 'text-white/85' : 'opacity-75'
                          }`}
                        >
                          Manage users & delete profiles
                        </span>
                      </div>
                    </Link>
                  )}
                </nav>
              </div>

              <div className="pt-4 border-t border-[#7A9E7E]/20 space-y-3">
                {user && (
                  <div className="text-xs">
                    <span className="font-bold block truncate">{user.name}</span>
                    <span className="text-[11px] opacity-65 block truncate">{user.email}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold border border-[#D52073]/30 text-[#D52073] hover:bg-[#D52073]/10 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            </aside>
          </div>,
          document.body
        )}
    </>
  );
}
