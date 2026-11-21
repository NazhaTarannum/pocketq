'use client';

/**
 * @file app/settings/page.tsx
 * @description User preferences workspace for currency, low-balance alert thresholds, and notification toggles.
 *
 * Responsibilities:
 * 1. Global Currency Personalization: Dynamically enumerates all ISO 4217 world currencies
 *    via `Intl.supportedValuesOf('currency')` (with BDT ৳ pinned first) and persists the user's
 *    selection to the `UserSettings` SQLite singleton.
 * 2. Alert Thresholds & Notification Preferences: Configures the low-balance comfort threshold
 *    and toggles deadline reminders and budget overspending alerts.
 * 3. Custom Categories Manager: Creates custom EXPENSE or INCOME categories (`CustomCategory` model)
 *    that immediately appear across transaction and budget workflows.
 * 4. Theme & Data Export: Toggles Light/Dark mode and provides a one-click JSON backup export
 *    of all wallets, transactions, obligations, savings, loans, and budgets.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sun,
  Moon,
  Settings,
  Bell,
  Tag,
  Download,
  CheckCircle2,
  Plus,
} from 'lucide-react';

/**
 * Represents the persisted user preferences row (`UserSettings` id = "default").
 */
interface UserSettingsData {
  id: string;
  currencySymbol: string;
  currencyCode: string;
  lowBalanceThreshold: number;
  enableReminders: boolean;
  enableBudgetAlerts: boolean;
}

/**
 * Represents a user-defined income or expense category (`CustomCategory` table).
 */
interface CustomCategoryItem {
  id: string;
  name: string;
  type: 'EXPENSE' | 'INCOME';
}

/**
 * Normalized currency option entry used by the currency selector dropdown.
 */
interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

/**
 * Resolves the narrow currency symbol (e.g. "৳", "$", "€", "£", "¥") for a given ISO 4217 code.
 * Falls back cleanly to the ISO code if a browser locale lacks a dedicated glyph.
 */
function resolveCurrencySymbol(code: string): string {
  if (code === 'BDT') return '৳';
  try {
    const parts = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    const sym = parts.find((p) => p.type === 'currency')?.value;
    return sym || code;
  } catch {
    return code;
  }
}

/**
 * Builds the complete list of all ISO 4217 world currencies supported by the runtime,
 * pinning BDT (Bangladeshi Taka) at the top and sorting remaining currencies alphabetically.
 */
function buildAllWorldCurrencies(): CurrencyOption[] {
  const displayNames =
    typeof Intl !== 'undefined' && 'DisplayNames' in Intl
      ? new Intl.DisplayNames(['en'], { type: 'currency' })
      : null;

  // Retrieve every standard ISO 4217 currency code supported by the JS engine
  const rawCodes: string[] =
    typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
      ? (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf(
          'currency'
        )
      : ['BDT', 'USD', 'EUR', 'GBP', 'INR', 'AED', 'SAR', 'CAD', 'AUD', 'SGD', 'MYR', 'JPY'];

  // Ensure BDT is always present and placed first
  const uniqueCodes = ['BDT', ...rawCodes.filter((c) => c !== 'BDT')];

  const mapped = uniqueCodes.map((code) => {
    const symbol = resolveCurrencySymbol(code);
    const fullName = displayNames?.of(code) || code;
    return {
      code,
      symbol,
      label: `${code} (${symbol}) — ${fullName}`,
    };
  });

  // Keep BDT pinned at index 0, sort all other currencies alphabetically by ISO code
  const [bdt, ...rest] = mapped;
  rest.sort((a, b) => a.code.localeCompare(b.code));
  return [bdt, ...rest];
}

export default function SettingsPage() {
  // Memoize the full ISO 4217 world currency list so it is computed once per mount
  const allCurrencies = useMemo(() => buildAllWorldCurrencies(), []);

  // UI & network state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Full dashboard snapshot held in state for one-click JSON backup export
  const [rawSnapshot, setRawSnapshot] = useState<unknown>(null);

  // Controlled form state for UserSettings
  const [currencySymbol, setCurrencySymbol] = useState('৳');
  const [currencyCode, setCurrencyCode] = useState('BDT');
  const [currencySearch, setCurrencySearch] = useState('');
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState('2000');
  const [enableReminders, setEnableReminders] = useState(true);
  const [enableBudgetAlerts, setEnableBudgetAlerts] = useState(true);

  // Controlled form state for CustomCategory creation
  const [customCategories, setCustomCategories] = useState<CustomCategoryItem[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  // Filter world currencies by ISO code, symbol, or full currency name while always keeping the active selection visible
  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toLowerCase();
    if (!q) return allCurrencies;
    return allCurrencies.filter(
      (c) => c.code === currencyCode || c.label.toLowerCase().includes(q)
    );
  }, [allCurrencies, currencySearch, currencyCode]);

  /**
   * Fetches current settings, custom categories, and full financial state from `/api/dashboard`.
   */
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      if (res.ok && json) {
        setRawSnapshot(json);
        if (json.settings) {
          const s: UserSettingsData = json.settings;
          setCurrencySymbol(s.currencySymbol || '৳');
          setCurrencyCode(s.currencyCode || 'BDT');
          setLowBalanceThreshold(String(s.lowBalanceThreshold ?? 2000));
          setEnableReminders(Boolean(s.enableReminders));
          setEnableBudgetAlerts(Boolean(s.enableBudgetAlerts));
        }
        if (Array.isArray(json.customCategories)) {
          setCustomCategories(json.customCategories);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  /**
   * Persists updated currency, alert threshold, and notification toggles to SQLite.
   */
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedBanner(false);
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_SETTINGS',
          currencySymbol,
          currencyCode,
          lowBalanceThreshold: Number(lowBalanceThreshold) || 0,
          enableReminders,
          enableBudgetAlerts,
        }),
      });
      if (res.ok) {
        setSavedBanner(true);
        await fetchSettings();
        setTimeout(() => setSavedBanner(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  /**
   * Creates a new custom EXPENSE or INCOME category and refreshes the list.
   */
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_CATEGORY',
          name: newCategoryName.trim(),
          type: newCategoryType,
        }),
      });
      setNewCategoryName('');
      await fetchSettings();
    } finally {
      setSaving(false);
    }
  };

  /**
   * Triggers a client-side JSON download containing all PocketQ financial records.
   */
  const handleExportJSON = () => {
    if (!rawSnapshot) return;
    const blob = new Blob([JSON.stringify(rawSnapshot, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pocketq-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E8F1F2] text-[#001A23] flex items-center justify-center font-semibold">
        Loading Settings & Personalization...
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        darkMode ? 'bg-black text-[#E8F1F2]' : 'bg-[#E8F1F2] text-[#001A23]'
      }`}
    >
      {/* Top Sticky Header */}
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md ${
          darkMode ? 'bg-black/90 border-[#31493C]' : 'bg-[#E8F1F2]/90 border-[#7A9E7E]/25'
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] hover:opacity-90"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#7A9E7E]" />
                Settings & Personalization
              </h1>
              <p className="text-[11px] opacity-70">
                Configure preferred currency ({allCurrencies.length} world currencies), alert thresholds, custom categories, and backups
              </p>
            </div>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            aria-label="Toggle theme"
            className={`p-2 rounded-xl border transition cursor-pointer ${
              darkMode
                ? 'bg-[#31493C]/50 border-[#31493C] text-[#FFEF5C]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Confirmation Banner on Save */}
        {savedBanner && (
          <div className="rounded-2xl p-3.5 bg-[#B3EFB2] text-[#001A23] text-xs font-bold flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Preferences saved! Active currency: {currencyCode} ({currencySymbol}).
          </div>
        )}

        {/* Section 1: Global Currency & Notification Preferences Form */}
        <form
          onSubmit={handleSaveSettings}
          className={`rounded-3xl p-6 border space-y-5 ${
            darkMode
              ? 'bg-[#31493C]/20 border-[#31493C]'
              : 'bg-white border-[#7A9E7E]/25 shadow-sm'
          }`}
        >
          <div>
            <h2 className="font-bold text-base mb-1">Currency & Alert Preferences</h2>
            <p className="text-xs opacity-75">
              Search and select from all {allCurrencies.length} world currencies and customize your alert thresholds
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Searchable Global ISO 4217 Currency Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold block">
                Preferred Currency ({allCurrencies.length} Available)
              </label>
              <input
                type="text"
                placeholder="Filter by code or name (e.g., BDT, USD, EUR, SAR, JPY)..."
                value={currencySearch}
                onChange={(e) => setCurrencySearch(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
              />
              <select
                value={currencyCode}
                onChange={(e) => {
                  const chosen = allCurrencies.find((c) => c.code === e.target.value);
                  if (chosen) {
                    setCurrencyCode(chosen.code);
                    setCurrencySymbol(chosen.symbol);
                  }
                }}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
              >
                {filteredCurrencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Low-Balance Threshold Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold block">
                Low Available-to-Spend Warning Threshold ({currencySymbol})
              </label>
              <p className="text-[11px] opacity-70">
                PocketQ alerts you whenever unreserved cash drops below this amount.
              </p>
              <input
                type="number"
                min="0"
                required
                value={lowBalanceThreshold}
                onChange={(e) => setLowBalanceThreshold(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
              />
            </div>
          </div>

          {/* Notification Toggles */}
          <div className="pt-2 border-t border-[#7A9E7E]/20 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-[#D52073]" /> Smart Notifications
            </span>

            <label className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-[#7A9E7E]/20 cursor-pointer">
              <div>
                <span className="text-xs font-bold block">Obligation Deadline Reminders</span>
                <span className="text-[11px] opacity-70">
                  Warn early when upcoming tuition, rent, or installment deadlines approach or face a shortfall
                </span>
              </div>
              <input
                type="checkbox"
                checked={enableReminders}
                onChange={(e) => setEnableReminders(e.target.checked)}
                className="w-4 h-4 accent-[#31493C] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-[#7A9E7E]/20 cursor-pointer">
              <div>
                <span className="text-xs font-bold block">Flexible Budget Overspending Alerts</span>
                <span className="text-[11px] opacity-70">
                  Notify when monthly category spending reaches 80% or exceeds your adjusted budget limit
                </span>
              </div>
              <input
                type="checkbox"
                checked={enableBudgetAlerts}
                onChange={(e) => setEnableBudgetAlerts(e.target.checked)}
                className="w-4 h-4 accent-[#31493C] cursor-pointer"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] hover:brightness-95 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>

        {/* Section 2: Custom Categories Manager */}
        <section
          className={`rounded-3xl p-6 border ${
            darkMode
              ? 'bg-[#31493C]/20 border-[#31493C]'
              : 'bg-white border-[#7A9E7E]/25 shadow-sm'
          }`}
        >
          <h2 className="font-bold text-base flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-[#7A9E7E]" />
            Custom Income & Expense Categories
          </h2>
          <p className="text-xs opacity-75 mb-4">
            Add personalized categories tailored to your lifestyle (e.g., Coaching, Books, Family Support)
          </p>

          <form onSubmit={handleAddCategory} className="flex flex-wrap gap-2 mb-4">
            <select
              value={newCategoryType}
              onChange={(e) => setNewCategoryType(e.target.value as 'EXPENSE' | 'INCOME')}
              className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
            >
              <option value="EXPENSE">Expense Category</option>
              <option value="INCOME">Income Category</option>
            </select>
            <input
              type="text"
              required
              placeholder="Category name..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-1 min-w-[180px] rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
            />
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Category
            </button>
          </form>

          {customCategories.length === 0 ? (
            <p className="text-xs opacity-65">No custom categories created yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {customCategories.map((cat) => (
                <span
                  key={cat.id}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#7A9E7E]/15 border border-[#7A9E7E]/25"
                >
                  {cat.name}{' '}
                  <span className="opacity-60 text-[10px]">({cat.type.toLowerCase()})</span>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Section 3: Data Backup & Portability */}
        <section
          className={`rounded-3xl p-6 border flex flex-wrap items-center justify-between gap-4 ${
            darkMode
              ? 'bg-[#31493C]/20 border-[#31493C]'
              : 'bg-white border-[#7A9E7E]/25 shadow-sm'
          }`}
        >
          <div>
            <h2 className="font-bold text-base mb-0.5">Data Backup & Export</h2>
            <p className="text-xs opacity-75">
              Download a complete JSON snapshot of your wallets, transactions, obligations, savings, and loans
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportJSON}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] hover:opacity-90 cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Export JSON Backup
          </button>
        </section>
      </main>
    </div>
  );
}
