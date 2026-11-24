'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Sun,
  Moon,
  LayoutDashboard,
  CalendarRange,
  Split,
  Plus,
  Settings,
} from 'lucide-react';
import AppSidebar from './AppSidebar';

interface AppHeaderProps {
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  onAddEntry?: () => void;
}

const DESKTOP_TABS = [
  { key: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { key: 'planning', label: 'Planning', href: '/planning', icon: CalendarRange },
  { key: 'split', label: 'Split Bill', href: '/split', icon: Split },
  { key: 'entry', label: '+ Entry', href: '/?add=1', icon: Plus },
  { key: 'settings', label: 'Settings', href: '/settings', icon: Settings },
];

const MOBILE_FOOTER_TABS = [
  { key: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { key: 'planning', label: 'Planning', href: '/planning', icon: CalendarRange },
  { key: 'split', label: 'Split Bill', href: '/split', icon: Split },
  { key: 'settings', label: 'Settings', href: '/settings', icon: Settings },
];

export default function AppHeader({ darkMode, onToggleDarkMode, onAddEntry }: AppHeaderProps) {
  const pathname = usePathname() || '/';
  const visibleDesktopTabs =
    pathname === '/' ? DESKTOP_TABS : DESKTOP_TABS.filter((t) => t.key !== 'entry');
  const router = useRouter();
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | HTMLAnchorElement | null>>({});
  const [underline, setUnderline] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const [internalDark, setInternalDark] = useState<boolean>(false);

  useEffect(() => {
    if (typeof darkMode === 'boolean') {
      setInternalDark(darkMode);
    } else if (typeof document !== 'undefined') {
      setInternalDark(document.documentElement.classList.contains('dark'));
    }
  }, [darkMode]);

  const isDark = typeof darkMode === 'boolean' ? darkMode : internalDark;

  const handleToggleDark = () => {
    if (onToggleDarkMode) {
      onToggleDarkMode();
    } else {
      const next = !isDark;
      setInternalDark(next);
      document.documentElement.classList.toggle('dark', next);
      try {
        localStorage.setItem('pocketq_dark_mode', String(next));
      } catch {}
    }
  };

  const handleTriggerEntry = () => {
    if (onAddEntry) {
      onAddEntry();
    } else {
      router.push('/?add=1');
    }
  };

  const activeKey =
    pathname === '/'
      ? 'dashboard'
      : pathname.startsWith('/planning')
      ? 'planning'
      : pathname.startsWith('/split')
      ? 'split'
      : pathname.startsWith('/settings')
      ? 'settings'
      : 'dashboard';

  useEffect(() => {
    const syncUnderline = () => {
      const container = navContainerRef.current;
      const activeEl = itemRefs.current[activeKey];
      if (container && activeEl) {
        const cRect = container.getBoundingClientRect();
        const aRect = activeEl.getBoundingClientRect();
        setUnderline({
          left: aRect.left - cRect.left,
          width: aRect.width,
        });
      }
    };
    syncUnderline();
    const t = setTimeout(syncUnderline, 60);
    window.addEventListener('resize', syncUnderline);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', syncUnderline);
    };
  }, [activeKey, pathname]);

  return (
    <>
      {/* TOP HEADER */}
      <header
        className={`sticky top-0 z-30 backdrop-blur-md transition-colors duration-200 ${
          isDark ? 'text-[#E8F1F2]' : 'text-[#001A23]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <AppSidebar darkMode={isDark} />
            <Link href="/" className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#0F2C38] flex items-center justify-center text-[#3EE895] font-bold text-base sm:text-lg shadow-sm shrink-0">
                Q
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-base sm:text-lg tracking-tight leading-none truncate">
                  PocketQ
                </h1>
                <p className="text-xs opacity-70 mt-0.5 hidden sm:block">
                  Smart Financial Companion
                </p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-5 shrink-0">
            {/* Mobile "+ Entry" Pill in Top Header (Dashboard) */}
            {pathname === '/' && (
              <button
                type="button"
                onClick={handleTriggerEntry}
                className={`md:hidden inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                  isDark
                    ? 'bg-[#3EE895]/20 text-[#3EE895] border border-[#3EE895]/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                    : 'bg-[#0F2C38] text-[#3EE895] shadow-sm'
                }`}
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.75]" />
                <span>Entry</span>
              </button>
            )}

            {/* Desktop Navigation */}
            <nav
              ref={navContainerRef}
              aria-label="Primary Navigation"
              className="hidden md:flex relative items-center gap-6 py-1"
            >
              {visibleDesktopTabs.map((tab) => {
                const isActive = activeKey === tab.key;
                if (tab.key === 'entry') {
                  return (
                    <button
                      key={tab.key}
                      ref={(el) => {
                        itemRefs.current[tab.key] = el;
                      }}
                      onClick={handleTriggerEntry}
                      className="relative pb-1.5 text-[13px] font-medium tracking-tight opacity-70 hover:opacity-100 transition-opacity duration-200 cursor-pointer bg-transparent border-0"
                    >
                      {tab.label}
                    </button>
                  );
                }

                return (
                  <Link
                    key={tab.key}
                    ref={(el) => {
                      itemRefs.current[tab.key] = el;
                    }}
                    href={tab.href}
                    className={`relative pb-1.5 text-[13px] tracking-tight transition-opacity duration-200 ${
                      isActive ? 'opacity-100 font-semibold' : 'opacity-65 hover:opacity-100 font-medium'
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}

              <span
                aria-hidden="true"
                style={{
                  transform: `translateX(${underline.left}px)`,
                  width: `${underline.width}px`,
                }}
                className={`pointer-events-none absolute bottom-0 left-0 h-[2px] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isDark ? 'bg-[#18D476]' : 'bg-[#0A8F4C]'
                }`}
              />
            </nav>

            <button
              onClick={handleToggleDark}
              aria-label="Toggle theme"
              className="p-2 rounded-xl opacity-80 hover:opacity-100 transition-opacity cursor-pointer bg-transparent border-0 shrink-0"
            >
              {isDark ? <Sun className="w-4 h-4 text-[#FFEF5C]" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE FLOATING LIQUID GLASS FOOTER NAVIGATION */}
      <footer
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-1.5 pointer-events-none"
      >
        <nav
          className={`pointer-events-auto max-w-md mx-auto rounded-3xl px-2 py-1.5 flex items-center justify-around gap-1 backdrop-blur-2xl transition-all ${
            isDark
              ? 'bg-[#0B1215]/75 border border-white/12 shadow-[0_14px_34px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.12)] text-[#E8F1F2]'
              : 'bg-white/75 border border-white/80 shadow-[0_12px_30px_rgba(0,26,35,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] text-[#001A23]'
          }`}
        >
          {MOBILE_FOOTER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeKey === tab.key;

            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-2xl text-[10px] transition-all ${
                  isActive
                    ? isDark
                      ? 'bg-[#3EE895]/18 text-[#3EE895] font-extrabold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]'
                      : 'bg-[#0A8F4C]/12 text-[#0A8F4C] font-extrabold shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]'
                    : 'opacity-65 hover:opacity-100 font-medium'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate max-w-full">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </footer>
    </>
  );
}
