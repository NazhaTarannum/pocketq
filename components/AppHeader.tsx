'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Sun, Moon } from 'lucide-react';
import AppSidebar from './AppSidebar';

interface AppHeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onAddEntry?: () => void;
}

const TABS = [
  { key: 'dashboard', label: 'Dashboard', href: '/' },
  { key: 'planning', label: 'Planning', href: '/planning' },
  { key: 'split', label: 'Split Bill', href: '/split' },
  { key: 'entry', label: '+ Entry', href: '/?add=1' },
  { key: 'settings', label: 'Settings', href: '/settings' },
];

export default function AppHeader({ darkMode, onToggleDarkMode, onAddEntry }: AppHeaderProps) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | HTMLAnchorElement | null>>({});
  const [underline, setUnderline] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

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
    <header
      className={`sticky top-0 z-30 backdrop-blur-md transition-colors duration-200 ${
        darkMode ? 'text-[#E8F1F2]' : 'text-[#001A23]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Brand + Sidebar Menu */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <AppSidebar darkMode={darkMode} />
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-[#0F2C38] flex items-center justify-center text-[#3EE895] font-bold text-base sm:text-lg shadow-sm shrink-0">
              Q
            </div>
            <div className="hidden min-[420px]:block truncate">
              <h1 className="font-bold text-base sm:text-lg tracking-tight leading-none">PocketQ</h1>
              <p className="text-xs opacity-70 mt-0.5 hidden sm:block">Smart Financial Companion</p>
            </div>
          </Link>
        </div>

        {/* Right Smooth Sliding-Underline Tabs */}
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <nav
            ref={navContainerRef}
            aria-label="Primary Navigation"
            className="relative flex items-center gap-3.5 sm:gap-6 py-1"
          >
            {TABS.map((tab) => {
              const isActive = activeKey === tab.key;
              if (tab.key === 'entry') {
                return (
                  <button
                    key={tab.key}
                    ref={(el) => {
                      itemRefs.current[tab.key] = el;
                    }}
                    onClick={() => {
                      if (onAddEntry) {
                        onAddEntry();
                      } else {
                        router.push('/?add=1');
                      }
                    }}
                    className="relative pb-1.5 text-xs sm:text-[13px] font-medium tracking-tight opacity-70 hover:opacity-100 transition-opacity duration-200 cursor-pointer bg-transparent border-0"
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
                  className={`relative pb-1.5 text-xs sm:text-[13px] tracking-tight transition-opacity duration-200 ${
                    tab.key === 'settings' ? 'hidden md:inline-block' : ''
                  } ${isActive ? 'opacity-100 font-semibold' : 'opacity-65 hover:opacity-100 font-medium'}`}
                >
                  {tab.label}
                </Link>
              );
            })}

            {/* Sliding Emerald Indicator */}
            <span
              aria-hidden="true"
              style={{
                transform: `translateX(${underline.left}px)`,
                width: `${underline.width}px`,
              }}
              className={`pointer-events-none absolute bottom-0 left-0 h-[2px] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                darkMode ? 'bg-[#18D476]' : 'bg-[#0A8F4C]'
              }`}
            />
          </nav>

          <button
            onClick={onToggleDarkMode}
            aria-label="Toggle theme"
            className="p-1.5 opacity-75 hover:opacity-100 transition-opacity cursor-pointer bg-transparent border-0 shrink-0"
          >
            {darkMode ? <Sun className="w-4 h-4 text-[#FFEF5C]" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
