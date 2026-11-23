'use client';
import DDMMYYYYInput from '@/components/DDMMYYYYInput';

import AppHeader from '@/components/AppHeader';
import Link from 'next/link';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Sun,
  Moon,
  Repeat,
  ArrowLeft,
  Plus,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Calendar,
  Clock,
  AlertTriangle,
  Lock,
  Edit3,
  Trash2,
  Wallet,
  History,
  ChevronRight,
  X,
} from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import { useThemePreference } from '@/lib/useThemePreference';
import { formatDateDDMMYYYY } from '@/lib/format';
import {
  BillingFrequency,
  CustomIntervalUnit,
  CycleDisplayStatus,
  computeCycleDateFromAnchor,
  formatFrequencyLabel,
  generateUpcomingSchedule,
  toISODateString,
} from '@/lib/subscriptions';

interface WalletItem {
  id: string;
  name: string;
  balance: number;
}

interface PaymentHistoryItem {
  id: string;
  subscriptionId: string;
  walletId: string | null;
  walletName: string | null;
  amount: number;
  dueDate: string;
  paidDate: string;
  note: string | null;
  subscription?: {
    id: string;
    name: string;
  };
}

interface SubscriptionItem {
  id: string;
  name: string;
  amount: number;
  startDate: string;
  billingCycle: BillingFrequency;
  customIntervalValue: number | null;
  customIntervalUnit: CustomIntervalUnit | null;
  customCycleDays: number | null;
  defaultWalletId: string | null;
  defaultWalletName: string | null;
  nextRenewalDate: string;
  lastPaidDate: string | null;
  status: 'ACTIVE' | 'CANCELLED';
  note: string | null;
  frequencyLabel: string;
  displayStatus: CycleDisplayStatus;
  daysUntilDue: number;
  canSettle: boolean;
  blockReason: string | null;
  monthlyEquivalent: number;
  yearlyEquivalent: number;
  upcomingDates: string[];
  payments: PaymentHistoryItem[];
}

interface SubscriptionsPayload {
  settings?: {
    currencySymbol?: string;
  };
  wallets: WalletItem[];
  subscriptions: SubscriptionItem[];
  paymentHistory: PaymentHistoryItem[];
  summary: {
    activeCount: number;
    cancelledCount: number;
    dueNowCount: number;
    totalMonthlyCost: number;
    totalYearlyCost: number;
  };
}

const FREQUENCY_OPTIONS: { value: BillingFrequency; label: string; hint: string }[] = [
  { value: 'WEEKLY', label: 'Weekly', hint: 'Every 7 days' },
  { value: 'MONTHLY', label: 'Monthly', hint: 'Every 1 month' },
  { value: 'QUARTERLY', label: 'Quarterly', hint: 'Every 3 months' },
  { value: 'HALF_YEARLY', label: 'Half-Yearly', hint: 'Every 6 months' },
  { value: 'YEARLY', label: 'Yearly', hint: 'Every 12 months' },
  { value: 'CUSTOM', label: 'Custom Interval', hint: 'Days, weeks, months, or years' },
];

export default function SubscriptionsPage() {
  const [darkMode, setDarkMode] = useThemePreference();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [data, setData] = useState<SubscriptionsPayload>({
    settings: { currencySymbol: '৳' },
    wallets: [],
    subscriptions: [],
    paymentHistory: [],
    summary: {
      activeCount: 0,
      cancelledCount: 0,
      dueNowCount: 0,
      totalMonthlyCost: 0,
      totalYearlyCost: 0,
    },
  });

  // Add / Edit Subscription Form State
  const [editingSub, setEditingSub] = useState<SubscriptionItem | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [billingCycle, setBillingCycle] = useState<BillingFrequency>('MONTHLY');
  const [customIntervalValue, setCustomIntervalValue] = useState('2');
  const [customIntervalUnit, setCustomIntervalUnit] = useState<CustomIntervalUnit>('MONTHS');
  const [defaultWalletId, setDefaultWalletId] = useState('');
  const [note, setNote] = useState('');

  // Payment Confirmation Modal State
  const [settleTarget, setSettleTarget] = useState<SubscriptionItem | null>(null);
  const [settleWalletId, setSettleWalletId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');

  // Active View Tab ('ALL' | 'DUE' | 'CANCELLED')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DUE' | 'CANCELLED'>('ALL');

  const currency = data.settings?.currencySymbol || '৳';

  useEffect(() => {
    const savedTheme = localStorage.getItem('pocketq-theme');
    if (savedTheme === 'dark') setDarkMode(true);
    const today = new Date().toISOString().slice(0, 10);
    setStartDate(today);
    fetchSubscriptions();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('pocketq-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  async function fetchSubscriptions() {
    try {
      setLoading(true);
      const res = await fetch('/api/subscriptions', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load subscriptions');
      setData(json);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load subscriptions');
    } finally {
      setLoading(false);
    }
  }

  // Live automatic due-date & upcoming schedule preview in the setup form
  const livePreview = useMemo(() => {
    if (!startDate) return null;
    try {
      const config = {
        startDate,
        billingCycle,
        customIntervalValue: billingCycle === 'CUSTOM' ? Math.max(1, Number(customIntervalValue) || 1) : null,
        customIntervalUnit: billingCycle === 'CUSTOM' ? customIntervalUnit : null,
      };
      const firstDue = computeCycleDateFromAnchor(config, 1);
      const upcoming = generateUpcomingSchedule(config, firstDue, 4);
      return {
        firstDueISO: toISODateString(firstDue),
        upcoming,
        frequencyLabel: formatFrequencyLabel(config),
      };
    } catch {
      return null;
    }
  }, [startDate, billingCycle, customIntervalValue, customIntervalUnit]);

  function resetForm() {
    setEditingSub(null);
    setName('');
    setAmount('');
    setStartDate(new Date().toISOString().slice(0, 10));
    setBillingCycle('MONTHLY');
    setCustomIntervalValue('2');
    setCustomIntervalUnit('MONTHS');
    setDefaultWalletId('');
    setNote('');
  }

  function startEdit(sub: SubscriptionItem) {
    setErrorMsg(null);
    setSuccessMsg(null);
    setEditingSub(sub);
    setName(sub.name);
    setAmount(String(sub.amount));
    setStartDate(toISODateString(sub.startDate));
    setBillingCycle(sub.billingCycle);
    setCustomIntervalValue(String(sub.customIntervalValue || 1));
    setCustomIntervalUnit(sub.customIntervalUnit || 'MONTHS');
    setDefaultWalletId(sub.defaultWalletId || '');
    setNote(sub.note || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSaveSubscription(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please enter a subscription name.');
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid subscription price greater than 0.');
      return;
    }
    if (!startDate) {
      setErrorMsg('Please select a purchase or start date.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        amount: parsedAmount,
        startDate,
        billingCycle,
        customIntervalValue: billingCycle === 'CUSTOM' ? Math.max(1, Number(customIntervalValue) || 1) : null,
        customIntervalUnit: billingCycle === 'CUSTOM' ? customIntervalUnit : null,
        defaultWalletId: defaultWalletId || null,
        note: note.trim() || null,
      };

      const res = editingSub
        ? await fetch(`/api/subscriptions/${editingSub.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'UPDATE', ...payload }),
          })
        : await fetch('/api/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save subscription');

      setSuccessMsg(
        editingSub
          ? `Updated "${name.trim()}" and recalculated billing schedule.`
          : `Added "${name.trim()}" — next due date automatically set.`
      );
      resetForm();
      await fetchSubscriptions();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save subscription');
    } finally {
      setSubmitting(false);
    }
  }

  function openSettleModal(sub: SubscriptionItem) {
    if (!sub.canSettle) {
      setErrorMsg(
        sub.blockReason ||
          'Upcoming bills cannot be paid before their due date.'
      );
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setSettleTarget(sub);
    setSettleWalletId(sub.defaultWalletId || data.wallets[0]?.id || '');
    setSettleAmount(String(sub.amount));
    setSettleNote(sub.note || '');
  }

  async function handleConfirmPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!settleTarget) return;

    if (!settleTarget.canSettle) {
      setErrorMsg('Upcoming bills cannot be settled in advance.');
      setSettleTarget(null);
      return;
    }
    if (!settleWalletId) {
      setErrorMsg('Please select a wallet to deduct the payment from.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await fetch(`/api/subscriptions/${settleTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SETTLE_PAYMENT',
          walletId: settleWalletId,
          amount: Number(settleAmount) || settleTarget.amount,
          note: settleNote.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Payment could not be settled');

      setSuccessMsg(
        `Payment confirmed for ${settleTarget.name}. Wallet deducted, expense logged, and next due date advanced.`
      );
      setSettleTarget(null);
      await fetchSubscriptions();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Settlement failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(sub: SubscriptionItem) {
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const nextStatus = sub.status === 'ACTIVE' ? 'CANCELLED' : 'ACTIVE';
      const res = await fetch(`/api/subscriptions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE_STATUS', status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update status');
      setSuccessMsg(
        nextStatus === 'CANCELLED'
          ? `Cancelled ${sub.name}. Future payable bills paused.`
          : `Reactivated ${sub.name}.`
      );
      await fetchSubscriptions();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to toggle status');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSubscription(sub: SubscriptionItem) {
    if (!window.confirm(`Delete "${sub.name}" and its schedule?`)) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/subscriptions/${sub.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete');
      if (editingSub?.id === sub.id) resetForm();
      setSuccessMsg(`Deleted "${sub.name}".`);
      await fetchSubscriptions();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete subscription');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredSubscriptions = useMemo(() => {
    if (statusFilter === 'DUE') {
      return data.subscriptions.filter((s) => s.status === 'ACTIVE' && s.canSettle);
    }
    if (statusFilter === 'CANCELLED') {
      return data.subscriptions.filter((s) => s.status === 'CANCELLED');
    }
    return data.subscriptions;
  }, [data.subscriptions, statusFilter]);

  function renderStatusBadge(sub: SubscriptionItem) {
    switch (sub.displayStatus) {
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            Overdue ({Math.abs(sub.daysUntilDue)}d)
          </span>
        );
      case 'DUE_TODAY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300">
            <Clock className="w-3.5 h-3.5" />
            Due Today
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Paid · Next in {sub.daysUntilDue}d
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <XCircle className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300">
            <Calendar className="w-3.5 h-3.5" />
            Upcoming (in {sub.daysUntilDue}d)
          </span>
        );
    }
  }

  return (
    <div className="min-h-screen bg-[#E8F1F2] dark:bg-[#31493C]/25 backdrop-blur-xl text-[#001A23] dark:text-[#E8F1F2] transition-colors duration-200">
      {/* Top Header */}
      <AppHeader darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Alerts */}
        {errorMsg && (
          <div className="rounded-2xl p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="rounded-2xl p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Summary KPI Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-3xl p-5 bg-white dark:bg-[#31493C]/20 border border-[#7A9E7E]/25 dark:border-[#31493C]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#31493C]/70 dark:text-slate-400">
              Active Subscriptions
            </p>
            <p className="text-2xl font-extrabold mt-1">{data.summary.activeCount}</p>
            <p className="text-xs text-slate-500 mt-1">
              {data.summary.cancelledCount} cancelled
            </p>
          </div>

          <div className="rounded-3xl p-5 bg-white dark:bg-[#31493C]/20 border border-[#7A9E7E]/25 dark:border-[#31493C]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#31493C]/70 dark:text-slate-400">
              Payable Today / Overdue
            </p>
            <p className="text-2xl font-extrabold mt-1">
              {data.summary.dueNowCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Future cycles stay locked until due
            </p>
          </div>

          <div className="rounded-3xl p-5 bg-white dark:bg-[#31493C]/20 border border-[#7A9E7E]/25 dark:border-[#31493C]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#31493C]/70 dark:text-slate-400">
              Monthly Run-Rate
            </p>
            <p className="text-2xl font-extrabold mt-1">
              {currency}
              {data.summary.totalMonthlyCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500 mt-1">Normalized across cycles</p>
          </div>

          <div className="rounded-3xl p-5 bg-white dark:bg-[#31493C]/20 border border-[#7A9E7E]/25 dark:border-[#31493C]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#31493C]/70 dark:text-slate-400">
              Annualized Commitment
            </p>
            <p className="text-2xl font-extrabold mt-1">
              {currency}
              {data.summary.totalYearlyCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500 mt-1">12-month projected spend</p>
          </div>
        </section>

        {/* Main 2-Column Layout: Setup Form + Schedule Workspace */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Add / Edit Subscription Setup Card */}
          <div className="lg:col-span-5 rounded-3xl p-6 bg-white dark:bg-[#31493C]/20 border border-[#7A9E7E]/25 dark:border-[#31493C] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold">
                  {editingSub ? `Edit "${editingSub.name}"` : 'Add a Subscription'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter start date & frequency — PocketQ calculates all future due dates automatically.
                </p>
              </div>
              {editingSub && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSaveSubscription} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Subscription Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Netflix, Spotify, Google One"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-transparent border border-[#7A9E7E]/30 outline-none focus:outline-none focus:ring-2 focus:ring-[#31493C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Price ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-transparent border border-[#7A9E7E]/30 outline-none focus:outline-none focus:ring-2 focus:ring-[#31493C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Purchase / Start Date *
                  </label>
                  <DDMMYYYYInput
                    
                    required
                    value={startDate}
                    onChange={setStartDate}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-transparent border border-[#7A9E7E]/30 outline-none focus:outline-none focus:ring-2 focus:ring-[#31493C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">Billing Frequency *</label>
                <div className="grid grid-cols-2 gap-2">
                  {FREQUENCY_OPTIONS.map((opt) => {
                    const active = billingCycle === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBillingCycle(opt.value)}
                        className={`text-left px-3 py-2 rounded-xl border text-xs transition cursor-pointer ${
                          active
                            ? 'bg-[#31493C] text-white border-[#31493C] font-semibold'
                            : 'bg-[#E8F1F2] dark:bg-[#31493C]/25 backdrop-blur-xl border-[#31493C]/15 dark:border-white/15 hover:border-[#31493C]/40'
                        }`}
                      >
                        <div>{opt.label}</div>
                        <div
                          className={`text-[11px] ${
                            active ? 'text-[#B3EFB2]' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {opt.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {billingCycle === 'CUSTOM' && (
                <div className="p-3.5 rounded-2xl bg-transparent border border-[#7A9E7E]/30 outline-none space-y-2">
                  <label className="block text-xs font-semibold">Custom Billing Interval</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="1"
                      max="3650"
                      value={customIntervalValue}
                      onChange={(e) => setCustomIntervalValue(e.target.value)}
                      className="px-3 py-2 rounded-xl text-sm bg-transparent border border-[#7A9E7E]/30 outline-none"
                    />
                    <select
                      value={customIntervalUnit}
                      onChange={(e) => setCustomIntervalUnit(e.target.value as CustomIntervalUnit)}
                      className="px-3 py-2 rounded-xl text-sm bg-transparent border border-[#7A9E7E]/30 outline-none"
                    >
                      <option value="DAYS">Days</option>
                      <option value="WEEKS">Weeks</option>
                      <option value="MONTHS">Months</option>
                      <option value="YEARS">Years</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Default Payment Wallet (Optional)
                </label>
                <select
                  value={defaultWalletId}
                  onChange={(e) => setDefaultWalletId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-transparent border border-[#7A9E7E]/30 outline-none"
                >
                  <option value="">Select wallet at payment time</option>
                  {data.wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({currency}
                      {w.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Optional Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Family plan, auto-debit card"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-transparent border border-[#7A9E7E]/30 outline-none"
                />
              </div>

              {/* Automatic Due Date Preview Box */}
              {livePreview && (
                <div className="p-3.5 rounded-2xl bg-[#31493C]/8 dark:bg-[#B3EFB2]/10 border border-[#31493C]/20 dark:border-[#B3EFB2]/20 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#31493C] dark:text-[#B3EFB2]">
                      Automatic Next Due Date
                    </span>
                    <span className="font-bold">
                      {formatDateDDMMYYYY(livePreview.firstDueISO)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    Schedule ({livePreview.frequencyLabel}):{' '}
                    {livePreview.upcoming.map((d) => formatDateDDMMYYYY(d)).join(' → ')}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl text-sm font-bold bg-[#FFEF5C] text-[#001A23] hover:brightness-95 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Saving...'
                    : editingSub
                      ? 'Save Subscription Changes'
                      : 'Create Subscription Schedule'}
                </span>
              </button>
            </form>
          </div>

          {/* RIGHT: Recurring Schedules & Payment History */}
          <div className="lg:col-span-7 space-y-6">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {(['ALL', 'DUE', 'CANCELLED'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      statusFilter === tab
                        ? 'bg-[#31493C] text-white'
                        : 'bg-transparent border border-[#7A9E7E]/30 outline-none'
                    }`}
                  >
                    {tab === 'ALL'
                      ? `All (${data.subscriptions.length})`
                      : tab === 'DUE'
                        ? `Payable Now (${data.summary.dueNowCount})`
                        : `Cancelled (${data.summary.cancelledCount})`}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500">
                Settlement unlocks automatically on each due date
              </span>
            </div>

            {/* Subscription Cards */}
            {filteredSubscriptions.length === 0 ? (
              <div className="rounded-3xl p-10 bg-white dark:bg-[#31493C]/20 border border-[#7A9E7E]/25 dark:border-[#31493C] text-center space-y-2">
                <Repeat className="w-8 h-8 mx-auto text-[#31493C]/50 dark:text-slate-500" />
                <p className="font-bold text-sm">No subscriptions in this view</p>
                <p className="text-xs text-slate-500">
                  Add a subscription on the left to automatically generate its recurring due dates.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSubscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className={`rounded-3xl p-5 bg-white dark:bg-[#31493C]/20 border transition ${
                      sub.canSettle
                        ? 'border-amber-400/70 dark:border-amber-500/40 shadow-sm'
                        : 'border-[#7A9E7E]/25 dark:border-[#31493C]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold">{sub.name}</h3>
                          {renderStatusBadge(sub)}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {sub.frequencyLabel} · Started {formatDateDDMMYYYY(sub.startDate)}
                          {sub.defaultWalletName ? ` · Wallet: ${sub.defaultWalletName}` : ''}
                        </p>
                        {sub.note && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                            “{sub.note}”
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-extrabold">
                          {currency}
                          {sub.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Next due: <span className="font-semibold">{formatDateDDMMYYYY(sub.nextRenewalDate)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Automatic Upcoming Billing Schedule */}
                    {sub.status === 'ACTIVE' && sub.upcomingDates.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-[#7A9E7E]/25 dark:border-[#31493C]">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                          Upcoming Automatic Schedule
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {sub.upcomingDates.map((isoDate, idx) => (
                            <span
                              key={isoDate}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs ${
                                idx === 0
                                  ? sub.canSettle
                                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 font-bold'
                                    : 'bg-[#31493C]/10 text-[#31493C] dark:bg-[#B3EFB2]/15 dark:text-[#B3EFB2] font-semibold'
                                  : 'bg-[#E8F1F2] dark:bg-[#31493C]/25 backdrop-blur-xl text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {formatDateDDMMYYYY(isoDate)}
                              {idx === 0 && (sub.canSettle ? ' (Payable)' : ' (Locked)')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Bar with Strict Settlement Gate */}
                    <div className="mt-4 pt-3 border-t border-[#7A9E7E]/25 dark:border-[#31493C] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openSettleModal(sub)}
                          disabled={!sub.canSettle}
                          title={
                            sub.canSettle
                              ? 'Confirm payment for this billing cycle'
                              : sub.blockReason || 'Upcoming bill cannot be paid before its due date'
                          }
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                            sub.canSettle
                              ? 'bg-[#31493C] text-[#B3EFB2] hover:opacity-95 cursor-pointer shadow-xs'
                              : 'bg-slate-200/80 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {sub.canSettle ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Confirm Payment</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>
                                {sub.status === 'CANCELLED'
                                  ? 'Cancelled'
                                  : `Settle Unlocks ${formatDateDDMMYYYY(sub.nextRenewalDate)}`}
                              </span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(sub)}
                          title="Edit subscription"
                          className="p-2 rounded-xl text-xs hover:bg-[#E8F1F2] dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(sub)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-[#E8F1F2] dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          {sub.status === 'ACTIVE' ? 'Cancel' : 'Reactivate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubscription(sub)}
                          title="Delete subscription"
                          className="p-2 rounded-xl text-xs hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Payment History Ledger */}
            <div className="rounded-3xl p-5 bg-white dark:bg-[#31493C]/20 border border-[#7A9E7E]/25 dark:border-[#31493C]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#31493C] dark:text-[#B3EFB2]" />
                  <h3 className="text-sm font-bold">Confirmed Payment History</h3>
                </div>
                <span className="text-xs text-slate-500">
                  {data.paymentHistory.length} settled cycle(s)
                </span>
              </div>

              {data.paymentHistory.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No subscription payments confirmed yet. When a bill reaches its due date and you confirm payment, it appears here.
                </p>
              ) : (
                <div className="divide-y divide-[#31493C]/10 dark:divide-white/10">
                  {data.paymentHistory.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold">
                          {item.subscription?.name || 'Subscription Payment'}
                        </p>
                        <p className="text-slate-500">
                          Cycle Due: {formatDateDDMMYYYY(item.dueDate)} · Paid:{' '}
                          {formatDateDDMMYYYY(item.paidDate)}
                          {item.walletName ? ` · via ${item.walletName}` : ''}
                        </p>
                      </div>
                      <div className="font-extrabold text-rose-600 dark:text-rose-400">
                        -{currency}
                        {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Payment Confirmation Modal (Only reachable for Due Today / Overdue bills) */}
      {settleTarget && (
        <div className="fixed inset-0 z-50 bg-[#31493C]/25 backdrop-blur-xl backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl p-6 bg-transparent border border-[#7A9E7E]/30 outline-none shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Confirm Subscription Payment</h3>
                <p className="text-xs text-slate-500">
                  {settleTarget.name} · Cycle due {formatDateDDMMYYYY(settleTarget.nextRenewalDate)}
                </p>
              </div>
              <button
                onClick={() => setSettleTarget(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Select Payment Wallet *
                </label>
                <div className="relative">
                  <select
                    required
                    value={settleWalletId}
                    onChange={(e) => setSettleWalletId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-transparent border border-[#7A9E7E]/30 outline-none"
                  >
                    <option value="">Choose wallet...</option>
                    {data.wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} — Balance: {currency}
                        {w.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Amount Due ({currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold bg-transparent border border-[#7A9E7E]/30 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Payment Note (Optional)</label>
                <input
                  type="text"
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  placeholder="Optional receipt or card note"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-transparent border border-[#7A9E7E]/30 outline-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-[#E8F1F2] dark:bg-[#31493C]/25 backdrop-blur-xl text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Wallet className="w-4 h-4 shrink-0 text-[#31493C] dark:text-[#B3EFB2]" />
                <span>
                  Deducts from selected wallet, logs an Expense transaction, and advances the next due date automatically.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettleTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#31493C]/15 dark:border-white/15 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#FFEF5C] text-[#001A23] hover:brightness-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>{submitting ? 'Confirming...' : 'Confirm & Deduct Wallet'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
