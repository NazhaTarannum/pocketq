'use client';

/**
 * @file app/subscriptions/page.tsx
 * @description Recurring subscription management workspace tracking billing cycles, renewal reminders, and normalized monthly/annual costs.
 * - Manage recurring monthly, yearly, and custom-day subscriptions.
 * - View normalized monthly & yearly recurring burn rates.
 * - Receive 7-day renewal alerts and record payments directly into wallet expenses.
 */

import React, { useEffect, useState } from 'react';
import {
  Sun,
  Moon,
  Repeat,
  Plus,
  BellRing,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import { formatDateDDMMYYYY } from '@/lib/format';

interface WalletItem {
  id: string;
  name: string;
  balance: number;
}

interface SubscriptionItem {
  id: string;
  name: string;
  amount: number;
  billingCycle: 'MONTHLY' | 'YEARLY' | 'CUSTOM';
  customCycleDays: number | null;
  nextRenewalDate: string;
  status: 'ACTIVE' | 'CANCELLED';
  note: string | null;
  monthlyEquivalent: number;
  yearlyEquivalent: number;
  daysUntilRenewal: number;
  isDueSoon: boolean;
}

interface SubscriptionsPayload {
  settings?: {
    currencySymbol?: string;
  };
  wallets: WalletItem[];
  subscriptions: SubscriptionItem[];
  subscriptionSummary: {
    activeCount: number;
    cancelledCount: number;
    totalMonthlyCost: number;
    totalYearlyCost: number;
  };
}


export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [subName, setSubName] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subCycle, setSubCycle] = useState<'MONTHLY' | 'YEARLY' | 'CUSTOM'>('MONTHLY');
  const [subCustomDays, setSubCustomDays] = useState('30');
  const [subNextDate, setSubNextDate] = useState('');
  const [subNote, setSubNote] = useState('');
  const [payWalletId, setPayWalletId] = useState('');

  const symbol = data?.settings?.currencySymbol || '৳';
  const formatMoney = (n: number) =>
    `${symbol}${Math.round(n).toLocaleString('en-IN')}`;

  const fetchData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      if (res.ok) {
        setData(json);
        if (json.wallets?.length > 0) {
          setPayWalletId((prev) => prev || json.wallets[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setSubNextDate((prev) => prev || today);
    fetchData();
  }, []);

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim() || !subAmount) return;
    setSubmitting(true);
    try {
      await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_SUBSCRIPTION',
          name: subName.trim(),
          amount: Number(subAmount),
          billingCycle: subCycle,
          customCycleDays: subCycle === 'CUSTOM' ? Number(subCustomDays) || 30 : null,
          nextRenewalDate: subNextDate,
          note: subNote,
        }),
      });
      setSubName('');
      setSubAmount('');
      setSubNote('');
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaySubscription = async (sub: SubscriptionItem) => {
    setSubmitting(true);
    try {
      await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PAY_SUBSCRIPTION',
          subscriptionId: sub.id,
          walletId: payWalletId || undefined,
          amount: sub.amount,
        }),
      });
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSubscription = async (sub: SubscriptionItem) => {
    setSubmitting(true);
    try {
      await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_SUBSCRIPTION_STATUS',
          subscriptionId: sub.id,
          status: sub.status === 'ACTIVE' ? 'CANCELLED' : 'ACTIVE',
        }),
      });
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#E8F1F2] text-[#001A23] flex items-center justify-center font-semibold">
        Loading Subscriptions...
      </div>
    );
  }

  const upcomingRenewals = data.subscriptions.filter((s) => s.isDueSoon);

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        darkMode ? 'bg-black text-[#E8F1F2]' : 'bg-[#E8F1F2] text-[#001A23]'
      }`}
    >
      {/* Top Sticky Header with 3-Line Sidebar Trigger */}
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md ${
          darkMode ? 'bg-black/90 border-[#31493C]' : 'bg-[#E8F1F2]/90 border-[#7A9E7E]/25'
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AppSidebar darkMode={darkMode} />
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight">
                Subscriptions
              </h1>
              <p className="text-[11px] opacity-70">
                Recurring service commitments, renewal reminders & forecast burn
              </p>
            </div>
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
        {/* Subscription Burn Summary Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            className={`rounded-3xl p-4 border ${
              darkMode
                ? 'bg-[#31493C]/25 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-xs'
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-70 block">
              Normalized Monthly Cost
            </span>
            <p className="text-2xl font-extrabold text-[#D52073] mt-1">
              {formatMoney(data.subscriptionSummary.totalMonthlyCost)}/mo
            </p>
            <span className="text-[11px] opacity-75">
              Included in 30/60/90-day cash forecasts
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
              Annualized Commitment
            </span>
            <p className="text-2xl font-extrabold mt-1">
              {formatMoney(data.subscriptionSummary.totalYearlyCost)}/yr
            </p>
            <span className="text-[11px] opacity-75">
              Across all active billing cycles
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
              Subscription Status
            </span>
            <p className="text-2xl font-extrabold text-[#7A9E7E] mt-1">
              {data.subscriptionSummary.activeCount} Active
            </p>
            <span className="text-[11px] opacity-75">
              {data.subscriptionSummary.cancelledCount} cancelled
            </span>
          </div>
        </section>

        {/* Upcoming Renewal Reminders Banner */}
        {upcomingRenewals.length > 0 && (
          <section className="rounded-3xl p-4 bg-[#FFEF5C]/30 border border-[#FFEF5C] space-y-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <BellRing className="w-4 h-4 text-[#D52073]" />
              Upcoming Renewals (Next 7 Days)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {upcomingRenewals.map((sub) => (
                <div
                  key={sub.id}
                  className="p-3 rounded-2xl bg-white/85 dark:bg-black/60 border border-[#7A9E7E]/25 flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="text-xs font-bold block">{sub.name}</span>
                    <span className="text-[11px] opacity-75">
                      {formatMoney(sub.amount)} • Due {formatDateDDMMYYYY(sub.nextRenewalDate)} (
                      {sub.daysUntilRenewal < 0
                        ? `${Math.abs(sub.daysUntilRenewal)}d overdue`
                        : sub.daysUntilRenewal === 0
                        ? 'Today'
                        : `in ${sub.daysUntilRenewal}d`}
                      )
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handlePaySubscription(sub)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#31493C] text-[#B3EFB2] cursor-pointer shrink-0"
                  >
                    Pay Now
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Subscription Manager Card */}
        <section
          className={`rounded-3xl p-6 border space-y-5 ${
            darkMode
              ? 'bg-[#31493C]/20 border-[#31493C]'
              : 'bg-white border-[#7A9E7E]/25 shadow-sm'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Repeat className="w-4 h-4 text-[#D52073]" />
              Manage Subscriptions
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="opacity-70">Default Payment Wallet:</span>
              <select
                value={payWalletId}
                onChange={(e) => setPayWalletId(e.target.value)}
                className="rounded-xl px-2.5 py-1.5 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
              >
                {data.wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({formatMoney(w.balance)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Add Subscription Form */}
          <form
            onSubmit={handleCreateSubscription}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 p-3.5 rounded-2xl bg-[#7A9E7E]/10 border border-[#7A9E7E]/20"
          >
            <input
              type="text"
              required
              placeholder="Service name (e.g., Spotify, iCloud)"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              className="lg:col-span-2 rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
            />
            <input
              type="number"
              min="1"
              step="any"
              required
              placeholder={`Cost (${symbol})`}
              value={subAmount}
              onChange={(e) => setSubAmount(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
            />
            <select
              value={subCycle}
              onChange={(e) => setSubCycle(e.target.value as 'MONTHLY' | 'YEARLY' | 'CUSTOM')}
              className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
              <option value="CUSTOM">Custom Days</option>
            </select>
            {subCycle === 'CUSTOM' ? (
              <input
                type="number"
                min="1"
                required
                placeholder="Every N days"
                value={subCustomDays}
                onChange={(e) => setSubCustomDays(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
              />
            ) : (
              <input
                type="date"
                required
                value={subNextDate}
                onChange={(e) => setSubNextDate(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
              />
            )}
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] hover:brightness-95 cursor-pointer flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
            {subCycle === 'CUSTOM' && (
              <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2">
                <span className="text-[11px] opacity-70">Next Renewal Date:</span>
                <input
                  type="date"
                  required
                  value={subNextDate}
                  onChange={(e) => setSubNextDate(e.target.value)}
                  className="rounded-xl px-3 py-1.5 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
                />
              </div>
            )}
          </form>

          {/* Subscriptions List */}
          {data.subscriptions.length === 0 ? (
            <p className="text-xs opacity-65 text-center py-6">
              No subscriptions tracked yet. Add your first recurring subscription above.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                    sub.status === 'CANCELLED'
                      ? 'opacity-65 border-[#7A9E7E]/20'
                      : darkMode
                      ? 'bg-black/50 border-[#31493C]'
                      : 'bg-[#E8F1F2]/60 border-[#7A9E7E]/25'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{sub.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sub.status === 'ACTIVE'
                            ? 'bg-[#B3EFB2] text-[#001A23]'
                            : 'bg-gray-300 text-gray-800'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>
                    <p className="text-xs opacity-75 mt-1">
                      {formatMoney(sub.amount)} •{' '}
                      {sub.billingCycle === 'CUSTOM'
                        ? `Every ${sub.customCycleDays} days`
                        : sub.billingCycle}{' '}
                      ({formatMoney(sub.monthlyEquivalent)}/mo • {formatMoney(sub.yearlyEquivalent)}/yr)
                    </p>
                    <p className="text-[11px] opacity-70 mt-0.5">
                      Next renewal: <strong>{formatDateDDMMYYYY(sub.nextRenewalDate)}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#7A9E7E]/15">
                    {sub.status === 'ACTIVE' && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handlePaySubscription(sub)}
                        className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] hover:opacity-90 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Record Payment
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleToggleSubscription(sub)}
                      className="py-1.5 px-3 rounded-xl text-xs font-bold border border-[#7A9E7E]/40 hover:bg-[#7A9E7E]/15 cursor-pointer flex items-center gap-1"
                    >
                      {sub.status === 'ACTIVE' ? (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-[#D52073]" /> Cancel
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-[#7A9E7E]" /> Reactivate
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
