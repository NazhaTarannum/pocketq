'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'pocketq-theme';

/**
 * Shared persistent Light/Dark theme hook across all PocketQ workspaces.
 * - Reads immediately from localStorage so navigation never flickers.
 * - Syncs with the user's saved `UserSettings.theme` in PostgreSQL.
 * - Persists changes to both localStorage and `/api/dashboard` (`UPDATE_THEME`).
 */
export function useThemePreference(): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [darkMode, setDarkModeState] = useState<boolean>(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === 'dark' || stored === 'light') {
      const isDark = stored === 'dark';
      setDarkModeState(isDark);
      document.documentElement.classList.toggle('dark', isDark);
    }

    // Hydrate authoritative saved preference from UserSettings in DB
    fetch('/api/dashboard', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const dbTheme = json?.settings?.theme;
        if (dbTheme === 'DARK' || dbTheme === 'LIGHT') {
          const isDark = dbTheme === 'DARK';
          setDarkModeState(isDark);
          window.localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
          document.documentElement.classList.toggle('dark', isDark);
        }
      })
      .catch(() => {});

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        const isDark = e.newValue === 'dark';
        setDarkModeState(isDark);
        document.documentElement.classList.toggle('dark', isDark);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setDarkMode = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setDarkModeState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, resolved ? 'dark' : 'light');
          document.documentElement.classList.toggle('dark', resolved);
        }
        fetch('/api/dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'UPDATE_THEME',
            theme: resolved ? 'DARK' : 'LIGHT',
          }),
        }).catch(() => {});
        return resolved;
      });
    },
    []
  );

  return [darkMode, setDarkMode];
}
