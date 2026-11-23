'use client';
import DDMMYYYYInput from '@/components/DDMMYYYYInput';

import { formatCurrency } from '@/lib/format';
import Link from 'next/link';

/**
 * @file app/wealth/page.tsx
 * @description Long-term investment and wealth portfolio workspace isolated from daily liquid cash.
 * - Manually record DPS, FDR, stocks, gold, crypto, or other assets.
 * - Track contributions, withdrawals, manual valuations, and unrealized gain/loss.
 * - Strictly isolated from Safe Available-to-Spend liquid cash.
 */

import React, { useEffect, useState } from 'react';
import {
  Sun,
  ArrowLeft,
  Moon,
  TrendingUp,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
} from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import { useThemePreference } from '@/lib/useThemePreference';
import { formatDateDDMMYYYY } from '@/lib/format';

interface WalletItem {
  id: string;
  name: string;
  balance: number;
}

interface InvestmentEventItem {
  id: string;
  eventType: 'INITIAL' | 'CONTRIBUTION' | 'WITHDRAWAL' | 'VALUATION_UPDATE';
  amount: number;
  valueAfter: number;
  note: string | null;
  eventDate: string;
}

interface InvestmentItem {
  id: string;
  name: string;
  assetType: string;
  investedAmount: number;
  currentValue: number;
  startDate: string;
  note: string | null;
  gainLoss: number;
  gainLossPercent: number;
  events: InvestmentEventItem[];
}

interface WealthPayload {
  settings?: {
    currencySymbol?: string;
  };
  summary?: {
    availableToSpend: number;
  };
  wallets: WalletItem[];
  investments: InvestmentItem[];
  investmentSummary: {
    totalInvested: number;
    currentValue: number;
    gainLoss: number;
    returnPercent: number;
    netWorthIncludingInvestments: number;
  };
}


const EMPTY_WEALTH_DATA: WealthPayload = {
  settings: { currencySymbol: '৳' },
  summary: { availableToSpend: 0 },
  wallets: [],
  investments: [],
  investmentSummary: {
    totalInvested: 0,
    currentValue: 0,
    gainLoss: 0,
    returnPercent: 0,
    netWorthIncludingInvestments: 0,
  },
};

export default function WealthPage() {
  const [data, setData] = useState<WealthPayload>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('pocketq_dashboard_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.investmentSummary) return parsed;
        }
      } catch {}
    }
    return EMPTY_WEALTH_DATA;
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [darkMode, setDarkMode] = useThemePreference();

  const [invName, setInvName] = useState('');
  const [invType, setInvType] = useState('DPS');
  const [invPrincipal, setInvPrincipal] = useState('');
  const [invCurrentVal, setInvCurrentVal] = useState('');
  const [invStartDate, setInvStartDate] = useState('');
  const [invWalletId, setInvWalletId] = useState('');
  const [invNote, setInvNote] = useState('');

  const [activeInvId, setActiveInvId] = useState<string | null>(null);
  const [invActionType, setInvActionType] = useState<
    'INVESTMENT_CONTRIBUTION' | 'INVESTMENT_WITHDRAWAL' | 'UPDATE_INVESTMENT_VALUE' | 'EDIT_INVESTMENT_PRINCIPAL'
  >('INVESTMENT_CONTRIBUTION');
  const [invActionAmount, setInvActionAmount] = useState('');
  const [invActionWalletId, setInvActionWalletId] = useState('');
  const [invActionNote, setInvActionNote] = useState('');

  const symbol = data?.settings?.currencySymbol || '৳';
  const formatMoney = (n: number) => formatCurrency(n, symbol);

  const fetchWealthData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      if (res.ok) {
        setData(json);
        try { sessionStorage.setItem('pocketq_dashboard_cache', JSON.stringify(json)); } catch {}
        if (json.wallets?.length > 0) {
          setInvActionWalletId((prev) => prev || json.wallets[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setInvStartDate((prev) => prev || today);
    fetchWealthData();
  }, []);

  const handleCreateInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName.trim() || !invPrincipal) return;
    setSubmitting(true);
    try {
      await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_INVESTMENT',
          name: invName.trim(),
          assetType: invType,
          investedAmount: Number(invPrincipal),
          currentValue: invCurrentVal !== '' ? Number(invCurrentVal) : Number(invPrincipal),
          startDate: invStartDate,
          walletId: invWalletId || undefined,
          note: invNote,
        }),
      });
      setInvName('');
      setInvPrincipal('');
      setInvCurrentVal('');
      setInvNote('');
      await fetchWealthData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvestmentAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvId || !invActionAmount) return;
    setSubmitting(true);
    try {
      await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: invActionType,
          investmentId: activeInvId,
          amount: Number(invActionAmount),
          investedAmount: Number(invActionAmount),
          currentValue: Number(invActionAmount),
          walletId:
            invActionType === 'UPDATE_INVESTMENT_VALUE'
              ? undefined
              : invActionWalletId || undefined,
          note: invActionNote,
        }),
      });
      setActiveInvId(null);
      setInvActionAmount('');
      setInvActionNote('');
      await fetchWealthData();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        darkMode ? 'bg-black text-[#E8F1F2]' : 'bg-[#E8F1F2] text-[#001A23]'
      }`}
    >
      {/* Top Sticky Header with 3-Line Sidebar Trigger */}
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md ${
          darkMode ? 'bg-black/90 border-[#31493C]' : 'bg-[#E8F1F2]/90 border-[#7A9E7E]/30'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AppSidebar darkMode={darkMode} />
            
            <h1 className="font-bold text-sm sm:text-lg leading-tight truncate">
              Wealth &amp; Investments
            </h1>
          </div>

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
        {/* Wealth Overview KPI Strip (Never Double-Counted in Safe Available-to-Spend) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className={`rounded-3xl p-4 border ${
              darkMode
                ? 'bg-[#31493C]/25 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-xs'
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-70 block">
              Total Invested
            </span>
            <p className="text-2xl font-extrabold mt-1">
              {formatMoney(data.investmentSummary.totalInvested)}
            </p>
            <span className="text-[11px] opacity-75">
              Net principal contributed
            </span>
          </div>

          <div
            className={`rounded-3xl p-4 border ${
              darkMode
                ? 'bg-[#31493C]/25 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-xs'
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-70 block">
              Current Value
            </span>
            <p className="text-2xl font-extrabold text-[#7A9E7E] mt-1">
              {formatMoney(data.investmentSummary.currentValue)}
            </p>
            <span className="text-[11px] font-semibold">
              {data.investmentSummary.gainLoss >= 0 ? '+' : ''}
              {formatMoney(data.investmentSummary.gainLoss)} (
              {data.investmentSummary.returnPercent >= 0 ? '+' : ''}
              {data.investmentSummary.returnPercent.toFixed(1)}%)
            </span>
          </div>

          <div className="rounded-3xl p-4 bg-[#31493C] text-[#E8F1F2] shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#B3EFB2] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Safe Spendable Cash
            </span>
            <p className="text-xl font-extrabold mt-1">
              {formatMoney(data.summary?.availableToSpend || 0)}
            </p>
            <span className="text-[11px] opacity-80 block mt-0.5">
              Excludes non-liquid investments
            </span>
          </div>

          <div
            className={`rounded-3xl p-4 border ${
              darkMode
                ? 'bg-[#31493C]/25 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-xs'
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-70 block">
              Total Net Worth
            </span>
            <p className="text-2xl font-extrabold mt-1">
              {formatMoney(data.investmentSummary.netWorthIncludingInvestments)}
            </p>
            <span className="text-[11px] opacity-75">
              Liquid wallets + investment assets
            </span>
          </div>
        </section>

        {/* Investment Portfolio & Performance Card */}
        <section
          className={`rounded-3xl p-6 border space-y-5 ${
            darkMode
              ? 'bg-[#31493C]/20 border-[#31493C]'
              : 'bg-white border-[#7A9E7E]/25 shadow-sm'
          }`}
        >
          <div>
            <h2 className="font-bold text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#7A9E7E]" />
              Investment Holdings
            </h2>
            <p className="text-xs opacity-75">
              Track DPS, FDR, stocks, gold, or funds separately from daily spendable cash
            </p>
          </div>

          {/* Add New Investment Form */}
          <form
            onSubmit={handleCreateInvestment}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 p-3.5 rounded-2xl bg-[#7A9E7E]/10 border border-[#7A9E7E]/20"
          >
            <input
              type="text"
              required
              placeholder="Asset name (e.g., Monthly DPS, DSE Stock)"
              value={invName}
              onChange={(e) => setInvName(e.target.value)}
              className="lg:col-span-2 rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
            />
            <select
              value={invType}
              onChange={(e) => setInvType(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
            >
              <option value="DPS">DPS / Savings Scheme</option>
              <option value="FDR">FDR / Fixed Deposit</option>
              <option value="STOCKS">Stocks / Mutual Fund</option>
              <option value="GOLD">Gold / Commodities</option>
              <option value="CRYPTO">Crypto</option>
              <option value="OTHER">Other Asset</option>
            </select>
            <input
              type="number"
              min="0"
              step="any"
              required
              placeholder={`Invested (${symbol})`}
              value={invPrincipal}
              onChange={(e) => setInvPrincipal(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
            />
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Current Value (opt)"
              value={invCurrentVal}
              onChange={(e) => setInvCurrentVal(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] hover:opacity-90 cursor-pointer flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Asset
            </button>

            <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2">
              <span className="text-[11px] opacity-70 shrink-0">Start Date:</span>
              <DDMMYYYYInput
                
                value={invStartDate}
                onChange={setInvStartDate}
                className="rounded-xl px-2.5 py-1.5 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2 min-w-0">
              <span className="text-[11px] opacity-70 shrink-0">Deduction from:</span>
              <select
                value={invWalletId}
                onChange={(e) => setInvWalletId(e.target.value)}
                className="flex-1 min-w-0 w-full truncate rounded-xl px-2.5 py-1.5 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
              >
                <option value="">No wallet deduction (external)</option>
                {data.wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({formatMoney(w.balance)})
                  </option>
                ))}
              </select>
            </div>
          </form>

          {/* Investment Holdings List */}
          {data.investments.length === 0 ? (
            <p className="text-xs opacity-65 text-center py-6">
              No investments added yet. Record your first DPS, stock, or asset above.
            </p>
          ) : (
            <div className="space-y-4">
              {data.investments.map((inv) => {
                const isGain = inv.gainLoss >= 0;
                const isEditingThis = activeInvId === inv.id;

                return (
                  <div
                    key={inv.id}
                    className={`p-4 rounded-2xl border space-y-3 ${
                      darkMode
                        ? 'bg-black/50 border-[#31493C]'
                        : 'bg-[#E8F1F2]/60 border-[#7A9E7E]/25'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{inv.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#31493C] text-[#B3EFB2]">
                            {inv.assetType}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-70 mt-0.5">
                          Started {formatDateDDMMYYYY(inv.startDate)} • Invested Principal:{' '}
                          <strong>{formatMoney(inv.investedAmount)}</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-extrabold block">
                          {formatMoney(inv.currentValue)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                            isGain ? 'text-[#7A9E7E]' : 'text-[#D52073]'
                          }`}
                        >
                          {isGain ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                          {isGain ? '+' : ''}
                          {formatMoney(inv.gainLoss)} ({isGain ? '+' : ''}
                          {inv.gainLossPercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveInvId(inv.id);
                          setInvActionType('INVESTMENT_CONTRIBUTION');
                          setInvActionAmount('');
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] cursor-pointer"
                      >
                        + Contribute
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveInvId(inv.id);
                          setInvActionType('INVESTMENT_WITHDRAWAL');
                          setInvActionAmount('');
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-[#7A9E7E]/40 cursor-pointer"
                      >
                        - Withdraw
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveInvId(inv.id);
                          setInvActionType('UPDATE_INVESTMENT_VALUE');
                          setInvActionAmount(String(inv.currentValue));
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] cursor-pointer"
                      >
                        Update Current Value
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveInvId(inv.id);
                          setInvActionType('EDIT_INVESTMENT_PRINCIPAL');
                          setInvActionAmount(String(inv.investedAmount));
                          setInvActionWalletId('');
                          setInvActionNote('');
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-[#7A9E7E]/40 cursor-pointer"
                      >
                        Edit Invested Principal
                      </button>
                    </div>

                    {/* Inline Action Form */}
                    {isEditingThis && (
                      <form
                        onSubmit={handleInvestmentAction}
                        className="p-3 rounded-xl bg-white/80 dark:bg-black/70 border border-[#7A9E7E]/30 flex flex-wrap items-center gap-2"
                      >
                        <span className="text-xs font-bold">
                          {invActionType === 'INVESTMENT_CONTRIBUTION'
                            ? 'Add Contribution:'
                            : invActionType === 'INVESTMENT_WITHDRAWAL'
                            ? 'Record Withdrawal:'
                            : invActionType === 'EDIT_INVESTMENT_PRINCIPAL'
                            ? 'Corrected Invested Principal:'
                            : 'New Current Value:'}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          placeholder={`Amount (${symbol})`}
                          value={invActionAmount}
                          onChange={(e) => setInvActionAmount(e.target.value)}
                          className="w-32 rounded-lg px-2.5 py-1.5 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
                        />
                        {invActionType !== 'UPDATE_INVESTMENT_VALUE' && (
                          <select
                            value={invActionWalletId}
                            onChange={(e) => setInvActionWalletId(e.target.value)}
                            className="rounded-lg px-2.5 py-1.5 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
                          >
                            <option value="">No wallet deduction (external)</option>
                            {data.wallets.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          placeholder="Note (optional)"
                          value={invActionNote}
                          onChange={(e) => setInvActionNote(e.target.value)}
                          className="flex-1 min-w-[140px] rounded-lg px-2.5 py-1.5 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
                        />
                        <button
                          type="submit"
                          disabled={submitting}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#31493C] text-[#B3EFB2] cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveInvId(null)}
                          className="px-2.5 py-1.5 rounded-lg text-xs opacity-70 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </form>
                    )}

                    {/* Historical Activity & Valuations */}
                    {inv.events && inv.events.length > 0 && (
                      <div className="pt-2 border-t border-[#7A9E7E]/15 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-65 block">
                          Performance & Activity History
                        </span>
                        <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                          {inv.events.map((ev) => (
                            <div
                              key={ev.id}
                              className="flex items-center justify-between text-[11px] opacity-80"
                            >
                              <span>
                                <strong>{ev.eventType.replace('_', ' ')}</strong> •{' '}
                                {formatDateDDMMYYYY(ev.eventDate)}
                                {ev.note ? ` — ${ev.note}` : ''}
                              </span>
                              <span>
                                Value: <strong>{formatMoney(ev.valueAfter)}</strong>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
