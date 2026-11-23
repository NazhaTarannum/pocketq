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
        className={`inline-flex items-center justify-center p-2 rounded-xl border transition cursor-pointer ${
          darkMode
            ? 'bg-[#31493C]/50 border-[#31493C] text-[#E8F1F2] hover:bg-[#31493C]'
            : 'bg-white border-[#7A9E7E]/30 text-[#001A23] hover:bg-[#7A9E7E]/10'
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
                darkMode ? 'bg-black/65 backdrop-blur-xs' : 'bg-[#001A23]/25 backdrop-blur-xs'
              }`}
            />

            <aside
              className={`pocketq-sidebar-drawer relative z-10 w-76 max-w-[84vw] h-dvh flex flex-col justify-between p-5 border-r shadow-2xl overflow-y-auto ${
                darkMode
                  ? 'text-[#E8F1F2] border-[#31493C]'
                  : 'text-[#001A23] border-[#7A9E7E]/30'
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
