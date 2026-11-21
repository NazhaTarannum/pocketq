'use client';

/**
 * @file app/reserved/page.tsx
 * @description Dedicated management view for upcoming obligations, reserved bills, and savings buckets.
 */

import DDMMYYYYInput from '@/components/DDMMYYYYInput';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarClock,
  Vault,
  Trash2,
  History,
  ShieldCheck,
  Sun,
  Moon,
  AlertTriangle,
  Pencil,
  Plus,
} from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import { useThemePreference } from '@/lib/useThemePreference';

interface WalletItem {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface ObligationInstallmentItem {
  id: string;
  title: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  isPaid: boolean;
}

interface FundingSchedulePoint {
  monthIndex: number;
  label: string;
  amount: number;
}

interface ObligationItem {
  id: string;
  title: string;
  totalAmount: number;
  reservedAmount: number;
  paidAmount: number;
  dueDate: string;
  category: string;
  notes?: string | null;
  targetWalletId?: string | null;
  targetWallet?: WalletItem | null;
  isPaid: boolean;
  installments: ObligationInstallmentItem[];
  outstandingTotal?: number;
  remainingToReserve?: number;
  daysRemaining?: number;
  monthsRemaining?: number;
  fundingPlan?: {
    schedule: FundingSchedulePoint[];
    totalPlanned: number;
    projectedShortfall: number;
    isShortfall: boolean;
    shortfallMessage: string | null;
    isCustomPlan: boolean;
  };
}

interface SavingsTransactionItem {
  id: string;
  type: string;
  amount: number;
  note?: string | null;
  walletName?: string | null;
  date: string;
}

interface SavingsGoalItem {
  id: string;
  name: string;
  currentBalance: number;
  targetAmount?: number | null;
  targetDate?: string | null;
  notes?: string | null;
  transactions: SavingsTransactionItem[];
}

interface DashboardData {
  summary: {
    totalBalance: number;
    totalReserved: number;
    totalReservedObligations: number;
    totalReservedSavings: number;
    totalUnreservedObligations?: number;
    totalObligationShortfall?: number;
    availableToSpend: number;
  };
  plannerContext?: {
    monthlyIncome: number;
    monthlyExpenses: number;
    expectedMonthlyIncome: number;
    expectedMonthlyExpenses: number;
  };
  wallets: WalletItem[];
  obligations: ObligationItem[];
  savingsGoals: SavingsGoalItem[];
}


export default function ReservedManagementPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useThemePreference();
  const [submitting, setSubmitting] = useState(false);

  const [activeModal, setActiveModal] = useState<
    | 'OBLIGATION'
    | 'RESERVE_OB'
    | 'EDIT_PLAN'
    | 'PAY_OB'
    | 'CREATE_SAVINGS'
    | 'SAVINGS_ACTION'
    | 'SAVINGS_HISTORY'
    | null
  >(null);

  // Create Obligation State
  const [obTitle, setObTitle] = useState('');
  const [obAmount, setObAmount] = useState('');
  const [obInitialReserved, setObInitialReserved] = useState('');
  const [obDueDate, setObDueDate] = useState('');
  const [obTargetWalletId, setObTargetWalletId] = useState('');
  const [obNotes, setObNotes] = useState('');
  const [obInstallments, setObInstallments] = useState<
    Array<{ title: string; amount: string; dueDate: string }>
  >([]);

  // Reserve / Edit Plan / Record Payment State
  const [selectedOb, setSelectedOb] = useState<ObligationItem | null>(null);
  const [reserveAmtInput, setReserveAmtInput] = useState('');
  const [reserveMode, setReserveMode] = useState<'ADD' | 'SET'>('ADD');
  const [reserveWalletId, setReserveWalletId] = useState('');
  const [editSchedule, setEditSchedule] = useState<Array<{ label: string; amount: string }>>([]);

  const [payInstallmentId, setPayInstallmentId] = useState('');
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payWalletId, setPayWalletId] = useState('');
  const [payDateInput, setPayDateInput] = useState('');
  const [payNoteInput, setPayNoteInput] = useState('');

  // Savings State (100% Flexible & User-Controlled)
  const [savName, setSavName] = useState('');
  const [savInitial, setSavInitial] = useState('');
  const [savTarget, setSavTarget] = useState('');
  const [savTargetDate, setSavTargetDate] = useState('');
  const [savNotes, setSavNotes] = useState('');
  const [selectedSavings, setSelectedSavings] = useState<SavingsGoalItem | null>(null);
  const [savActionMode, setSavActionMode] = useState<
    'DEPOSIT' | 'WITHDRAW' | 'SPEND' | 'EDIT_BALANCE'
  >('DEPOSIT');
  const [savActionAmount, setSavActionAmount] = useState('');
  const [savActionWalletId, setSavActionWalletId] = useState('');
  const [savActionCategory, setSavActionCategory] = useState('Shopping');
  const [savActionNote, setSavActionNote] = useState('');

  const formatBDT = (num: number) => `৳${Math.round(num).toLocaleString('en-IN')}`;
  const formatDateDDMMYYYY = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const fetchData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      if (res.ok && json && Array.isArray(json.obligations)) {
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleObligationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obTitle || !obAmount || !obDueDate) return;
    setSubmitting(true);
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'OBLIGATION',
        title: obTitle,
        totalAmount: Number(obAmount),
        reservedAmount: Number(obInitialReserved) || 0,
        dueDate: obDueDate,
        targetWalletId: obTargetWalletId || null,
        category: 'OBLIGATION',
        notes: obNotes,
        installments: obInstallments,
      }),
    });
    setObTitle('');
    setObAmount('');
    setObInitialReserved('');
    setObDueDate('');
    setObTargetWalletId('');
    setObNotes('');
    setObInstallments([]);
    setSubmitting(false);
    setActiveModal(null);
    fetchData();
  };

  const handleReserveObSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOb) return;
    setSubmitting(true);
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RESERVE_OBLIGATION',
        obligationId: selectedOb.id,
        amount: Number(reserveAmtInput) || 0,
        mode: reserveMode,
        walletId: reserveWalletId || selectedOb.targetWalletId || data?.wallets[0]?.id,
      }),
    });
    setReserveAmtInput('');
    setSubmitting(false);
    setActiveModal(null);
    fetchData();
  };

  const handleSaveCustomPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOb) return;
    setSubmitting(true);
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UPDATE_OBLIGATION_PLAN',
        obligationId: selectedOb.id,
        schedule: editSchedule.map((s) => ({
          label: s.label,
          amount: Number(s.amount) || 0,
        })),
      }),
    });
    setSubmitting(false);
    setActiveModal(null);
    fetchData();
  };

  const handleResetAutoPlan = async (obligationId: string) => {
    setSubmitting(true);
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UPDATE_OBLIGATION_PLAN',
        obligationId,
        schedule: null,
      }),
    });
    setSubmitting(false);
    setActiveModal(null);
    fetchData();
  };

  const handlePayObSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOb || !payAmountInput) return;
    setSubmitting(true);
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'PAY_OBLIGATION',
        obligationId: selectedOb.id,
        installmentId: payInstallmentId || null,
        amount: Number(payAmountInput),
        walletId: payWalletId || selectedOb.targetWalletId || data?.wallets[0]?.id,
        paymentDate: payDateInput,
        note: payNoteInput,
      }),
    });
    setPayAmountInput('');
    setPayNoteInput('');
    setSubmitting(false);
    setActiveModal(null);
    fetchData();
  };

  const handleDeleteObligation = async (obligationId: string) => {
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE_OBLIGATION', obligationId }),
    });
    fetchData();
  };

  const handleCreateSavingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savName.trim()) return;
    setSubmitting(true);
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CREATE_SAVINGS',
        name: savName,
        initialAmount: Number(savInitial) || 0,
        targetAmount: savTarget ? Number(savTarget) : null,
        targetDate: savTargetDate || null,
        notes: savNotes,
      }),
    });
    setSavName('');
    setSavInitial('');
    setSavTarget('');
    setSavTargetDate('');
    setSavNotes('');
    setSubmitting(false);
    setActiveModal(null);
    fetchData();
  };

  const handleSavingsActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSavings) return;
    setSubmitting(true);
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SAVINGS_ACTION',
        savingsGoalId: selectedSavings.id,
        mode: savActionMode,
        amount: Number(savActionAmount) || 0,
        walletId: savActionWalletId || data?.wallets[0]?.id,
        category: savActionCategory,
        note: savActionNote,
      }),
    });
    setSavActionAmount('');
    setSavActionNote('');
    setSubmitting(false);
    setActiveModal(null);
    fetchData();
  };

  const handleDeleteSavings = async (savingsGoalId: string) => {
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE_SAVINGS', savingsGoalId }),
    });
    fetchData();
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#E8F1F2] text-[#001A23] flex items-center justify-center font-semibold">
        Loading Reserved Funds & Savings...
      </div>
    );
  }

  const totalReq = data.obligations.reduce((s, o) => s + o.totalAmount, 0);
  const totalResOb = data.obligations.reduce((s, o) => s + (o.isPaid ? 0 : o.reservedAmount), 0);
  const totalPaidOb = data.obligations.reduce((s, o) => s + o.paidAmount, 0);
  const totalRemainingToReserve = data.obligations.reduce(
    (s, o) => s + (o.isPaid ? 0 : Math.max(0, o.totalAmount - o.paidAmount - o.reservedAmount)),
    0
  );
  const totalSaved = (data.savingsGoals || []).reduce((s, g) => s + g.currentBalance, 0);

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        darkMode ? 'bg-black text-[#E8F1F2]' : 'bg-[#E8F1F2] text-[#001A23]'
      }`}
    >
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md ${
          darkMode ? 'bg-black/90 border-[#31493C]' : 'bg-[#E8F1F2]/90 border-[#7A9E7E]/30'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AppSidebar darkMode={darkMode} />
            <Link
              href="/"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] hover:opacity-90 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Dashboard</span>
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-lg leading-tight truncate">
                Reserved Funds: Obligations vs. Savings
              </h1>
              <p className="text-[11px] opacity-70 hidden sm:block">
                Deadline-based funding planner for mandatory bills + user-controlled savings vaults
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

      <main className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-5 sm:space-y-6">
        <p className="text-xs opacity-75 sm:hidden -mt-1">
          Deadline-based funding planner for mandatory bills + user-controlled savings vaults
        </p>
        {/* Top Summary Strip */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl p-4 bg-[#31493C] text-[#E8F1F2]">
            <span className="text-[11px] opacity-75 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#B3EFB2]" /> Available to Spend
            </span>
            <p className="text-xl font-extrabold text-[#B3EFB2] mt-1">
              {formatBDT(data.summary.availableToSpend)}
            </p>
            <span className="text-[10px] opacity-70">Unreserved liquid cash</span>
          </div>

          <div
            className={`rounded-2xl p-4 border ${
              darkMode ? 'bg-[#31493C]/20 border-[#31493C]' : 'bg-white border-[#7A9E7E]/25'
            }`}
          >
            <span className="text-[11px] opacity-70 block">Obligations Reserved</span>
            <p className="text-xl font-extrabold text-[#7A9E7E] mt-1">{formatBDT(totalResOb)}</p>
            <span className="text-[10px] opacity-65">
              {formatBDT(totalRemainingToReserve)} left to reserve
            </span>
          </div>

          <div
            className={`rounded-2xl p-4 border ${
              darkMode ? 'bg-[#31493C]/20 border-[#31493C]' : 'bg-white border-[#7A9E7E]/25'
            }`}
          >
            <span className="text-[11px] opacity-70 block">Obligations Paid</span>
            <p className="text-xl font-extrabold mt-1">{formatBDT(totalPaidOb)}</p>
            <span className="text-[10px] opacity-65">Of {formatBDT(totalReq)} total required</span>
          </div>

          <div
            className={`rounded-2xl p-4 border ${
              darkMode ? 'bg-[#31493C]/20 border-[#31493C]' : 'bg-white border-[#7A9E7E]/25'
            }`}
          >
            <span className="text-[11px] opacity-70 block">Savings & Emergency</span>
            <p className="text-xl font-extrabold text-[#7A9E7E] mt-1">{formatBDT(totalSaved)}</p>
            <span className="text-[10px] opacity-65">100% flexible & user-controlled</span>
          </div>
        </section>

        {/* Two Main Categories: 1. Reserved Obligations (Deadline Planner) & 2. Savings (Flexible) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CATEGORY 1: RESERVED OBLIGATIONS (7 cols) */}
          <div
            className={`lg:col-span-7 rounded-3xl p-5 border ${
              darkMode
                ? 'bg-[#31493C]/20 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-sm'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="font-bold text-base flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-[#D52073]" />
                  1. Reserved Obligations — Deadline Funding Planner
                </h2>
                <p className="text-xs opacity-75">
                  Mandatory deadlines funded dynamically from your real cash flow (never auto-deducted)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setObTargetWalletId(data.wallets[0]?.id || '');
                  setActiveModal('OBLIGATION');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] hover:brightness-95 cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> New Obligation
              </button>
            </div>

            {data.obligations.length === 0 ? (
              <div className="py-10 text-center text-xs opacity-70 rounded-2xl border border-dashed border-[#7A9E7E]/30">
                No mandatory obligations added yet. Add tuition fees, loan installments, rent, or bills.
              </div>
            ) : (
              <div className="space-y-4">
                {data.obligations.map((ob) => {
                  const outstanding = Math.max(0, ob.totalAmount - ob.paidAmount);
                  const remToReserve = ob.isPaid
                    ? 0
                    : Math.max(0, outstanding - ob.reservedAmount);

                  return (
                    <div
                      key={ob.id}
                      className={`rounded-2xl p-4 border ${
                        darkMode
                          ? 'bg-[#001A23]/60 border-[#31493C]'
                          : 'bg-[#E8F1F2]/55 border-[#7A9E7E]/25'
                      }`}
                    >
                      {/* Title & Deadline Header */}
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-extrabold text-sm">{ob.title}</h3>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#31493C] text-[#B3EFB2]">
                              Due: {formatDateDDMMYYYY(ob.dueDate)}
                            </span>
                            {ob.targetWallet && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#7A9E7E]/15">
                                Wallet: {ob.targetWallet.name}
                              </span>
                            )}
                            {ob.isPaid && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#B3EFB2] text-[#001A23]">
                                Paid in Full
                              </span>
                            )}
                          </div>
                          {ob.notes && <p className="text-xs opacity-70 mt-1">{ob.notes}</p>}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteObligation(ob.id)}
                          className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:text-[#D52073] cursor-pointer"
                          title="Delete obligation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 4 Clear Distinct Figures: Required / Already Reserved / Remaining to Reserve / Actually Paid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
                        <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                          <span className="opacity-65 block text-[11px]">Amount Required</span>
                          <span className="font-extrabold text-sm">{formatBDT(ob.totalAmount)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#7A9E7E]/15">
                          <span className="opacity-75 block text-[11px]">Already Reserved</span>
                          <span className="font-extrabold text-sm text-[#7A9E7E]">
                            {formatBDT(ob.reservedAmount)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#FFEF5C]/25">
                          <span className="opacity-75 block text-[11px]">Remaining to Reserve</span>
                          <span className="font-extrabold text-sm">{formatBDT(remToReserve)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                          <span className="opacity-65 block text-[11px]">Actually Paid</span>
                          <span className="font-extrabold text-sm">{formatBDT(ob.paidAmount)}</span>
                        </div>
                      </div>

                      {/* Installment Breakdown if present */}
                      {ob.installments.length > 0 && (
                        <div className="mb-3 space-y-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider opacity-70 block">
                            Installments
                          </span>
                          {ob.installments.map((inst) => (
                            <div
                              key={inst.id}
                              className="flex items-center justify-between text-xs px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5"
                            >
                              <span>
                                <strong>{inst.title}</strong> • Due {formatDateDDMMYYYY(inst.dueDate)}
                              </span>
                              <span className="font-bold">
                                {formatBDT(inst.paidAmount)} / {formatBDT(inst.amount)}{' '}
                                {inst.isPaid ? '✓' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Adaptive Funding Plan & Shortfall Alert */}
                      {!ob.isPaid && remToReserve > 0 && ob.fundingPlan && (
                        <div className="mb-3 p-3 rounded-xl border border-[#7A9E7E]/25 bg-white/60 dark:bg-black/30">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-bold">
                              {ob.fundingPlan.isCustomPlan
                                ? 'Custom Reservation Plan'
                                : 'Adaptive Cash-Flow Funding Plan'}
                            </span>
                            <div className="flex items-center gap-2">
                              {ob.fundingPlan.isCustomPlan && (
                                <button
                                  type="button"
                                  onClick={() => handleResetAutoPlan(ob.id)}
                                  className="text-[11px] underline opacity-75 hover:opacity-100 cursor-pointer"
                                >
                                  Reset to Auto
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOb(ob);
                                  setEditSchedule(
                                    (ob.fundingPlan?.schedule || []).map((s) => ({
                                      label: s.label,
                                      amount: String(s.amount),
                                    }))
                                  );
                                  setActiveModal('EDIT_PLAN');
                                }}
                                className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[#7A9E7E]/20 hover:bg-[#7A9E7E]/30 cursor-pointer flex items-center gap-1"
                              >
                                <Pencil className="w-3 h-3" /> Edit Plan
                              </button>
                            </div>
                          </div>

                          {ob.fundingPlan.schedule.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {ob.fundingPlan.schedule.map((step) => (
                                <div
                                  key={step.monthIndex}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#7A9E7E]/15 text-xs"
                                >
                                  <span className="opacity-75">{step.label}: </span>
                                  <strong>Reserve {formatBDT(step.amount)}</strong>
                                </div>
                              ))}
                            </div>
                          )}

                          {ob.fundingPlan.isShortfall && ob.fundingPlan.shortfallMessage && (
                            <div className="mt-2 p-2.5 rounded-xl bg-[#D52073]/15 border border-[#D52073]/30 text-xs flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-[#D52073] shrink-0 mt-0.5" />
                              <span>{ob.fundingPlan.shortfallMessage}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Two Separate Actions: 1. Add to Reserved Amount | 2. Record Payment */}
                      {!ob.isPaid && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOb(ob);
                              setReserveMode('ADD');
                              const suggestedFirst = ob.fundingPlan?.schedule?.[0]?.amount || 0;
                              setReserveAmtInput(suggestedFirst > 0 ? String(suggestedFirst) : '');
                              setReserveWalletId(ob.targetWalletId || data.wallets[0]?.id || '');
                              setActiveModal('RESERVE_OB');
                            }}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] hover:brightness-95 cursor-pointer"
                          >
                            + Add to Reserved Amount
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOb(ob);
                              const firstUnpaid = ob.installments.find((i) => !i.isPaid);
                              setPayInstallmentId(firstUnpaid?.id || '');
                              setPayAmountInput(
                                String(
                                  firstUnpaid
                                    ? firstUnpaid.amount - firstUnpaid.paidAmount
                                    : ob.reservedAmount > 0
                                    ? ob.reservedAmount
                                    : outstanding
                                )
                              );
                              setPayWalletId(ob.targetWalletId || data.wallets[0]?.id || '');
                              setPayDateInput(new Date().toISOString().slice(0, 10));
                              setPayNoteInput('');
                              setActiveModal('PAY_OB');
                            }}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#31493C] text-[#E8F1F2] hover:opacity-90 cursor-pointer"
                          >
                            Record Payment
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CATEGORY 2: SAVINGS & EMERGENCY FUNDS (5 cols — 100% User-Controlled, No Compulsory Schedule or Progress Bars) */}
          <div
            className={`lg:col-span-5 rounded-3xl p-5 border ${
              darkMode
                ? 'bg-[#31493C]/20 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-sm'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="font-bold text-base flex items-center gap-2">
                  <Vault className="w-4 h-4 text-[#7A9E7E]" />
                  2. Savings & Emergency Funds
                </h2>
                <p className="text-xs opacity-75">
                  Optional, user-controlled money reserves—no deadlines or compulsory schedules
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('CREATE_SAVINGS')}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] hover:brightness-95 cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> New Savings
              </button>
            </div>

            {data.savingsGoals.length === 0 ? (
              <div className="py-10 text-center text-xs opacity-70 rounded-2xl border border-dashed border-[#7A9E7E]/30">
                Create custom savings entries like Emergency Funds, Japan Trip, or New Laptop.
              </div>
            ) : (
              <div className="space-y-3">
                {data.savingsGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className={`rounded-2xl p-4 border ${
                      darkMode
                        ? 'bg-[#001A23]/60 border-[#31493C]'
                        : 'bg-[#E8F1F2]/55 border-[#7A9E7E]/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-extrabold text-sm">{goal.name}</h3>
                        {goal.notes && <p className="text-xs opacity-70 mt-0.5">{goal.notes}</p>}
                        {(goal.targetAmount || goal.targetDate) && (
                          <p className="text-[11px] opacity-65 mt-1">
                            {goal.targetAmount ? `Optional goal: ${formatBDT(goal.targetAmount)}` : ''}
                            {goal.targetAmount && goal.targetDate ? ' • ' : ''}
                            {goal.targetDate ? `Target date: ${formatDateDDMMYYYY(goal.targetDate)}` : ''}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSavings(goal);
                            setActiveModal('SAVINGS_HISTORY');
                          }}
                          className="p-1.5 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
                          title="View history"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavings(goal.id)}
                          className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:text-[#D52073] cursor-pointer"
                          title="Delete savings entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mb-3">
                      <span className="text-[11px] opacity-65 block">Current Reserved Balance</span>
                      <span className="text-2xl font-extrabold text-[#7A9E7E]">
                        {formatBDT(goal.currentBalance)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSavings(goal);
                          setSavActionMode('DEPOSIT');
                          setSavActionAmount('');
                          setSavActionWalletId(data.wallets[0]?.id || '');
                          setSavActionNote('');
                          setActiveModal('SAVINGS_ACTION');
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] cursor-pointer"
                      >
                        + Add Money
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSavings(goal);
                          setSavActionMode('WITHDRAW');
                          setSavActionAmount('');
                          setSavActionWalletId(data.wallets[0]?.id || '');
                          setSavActionNote('');
                          setActiveModal('SAVINGS_ACTION');
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#31493C] text-[#E8F1F2] cursor-pointer"
                      >
                        Withdraw
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSavings(goal);
                          setSavActionMode('EDIT_BALANCE');
                          setSavActionAmount(String(goal.currentBalance));
                          setSavActionNote('');
                          setActiveModal('SAVINGS_ACTION');
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#7A9E7E]/20 cursor-pointer"
                      >
                        Edit Balance
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* MODAL 1: Create Reserved Obligation */}
      {activeModal === 'OBLIGATION' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-3xl p-6 border max-h-[90vh] overflow-y-auto ${
              darkMode
                ? 'bg-[#001A23] border-[#31493C] text-[#E8F1F2]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            <h3 className="text-lg font-extrabold mb-1">New Reserved Obligation</h3>
            <p className="text-xs opacity-75 mb-4">
              Does NOT auto-deduct from your available balance. PocketQ builds a realistic funding schedule toward your deadline.
            </p>
            <form onSubmit={handleObligationSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Obligation Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., University Trimester Fee, Rent, Credit Card"
                  value={obTitle}
                  onChange={(e) => setObTitle(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Total Amount Required (৳)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="15000"
                    value={obAmount}
                    onChange={(e) => setObAmount(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Already Reserved (৳)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={obInitialReserved}
                    onChange={(e) => setObInitialReserved(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Payment Deadline (dd/mm/yyyy)</label>
                  <DDMMYYYYInput
                    required
                    value={obDueDate}
                    onChange={setObDueDate}
                    className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Intended Payment Wallet</label>
                  <select
                    value={obTargetWalletId}
                    onChange={(e) => setObTargetWalletId(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                  >
                    <option value="">Select wallet (optional)</option>
                    {data.wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatBDT(w.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional Installment Schedule */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold">Installment Schedule (Optional)</span>
                  <button
                    type="button"
                    onClick={() =>
                      setObInstallments([
                        ...obInstallments,
                        { title: `Installment ${obInstallments.length + 1}`, amount: '', dueDate: '' },
                      ])
                    }
                    className="text-xs font-bold text-[#7A9E7E] cursor-pointer"
                  >
                    + Add Installment
                  </button>
                </div>
                {obInstallments.map((inst, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Title"
                      value={inst.title}
                      onChange={(e) => {
                        const copy = [...obInstallments];
                        copy[idx].title = e.target.value;
                        setObInstallments(copy);
                      }}
                      className="rounded-xl px-2.5 py-1.5 text-xs border border-[#7A9E7E]/30 bg-transparent"
                    />
                    <input
                      type="number"
                      placeholder="Amount (৳)"
                      value={inst.amount}
                      onChange={(e) => {
                        const copy = [...obInstallments];
                        copy[idx].amount = e.target.value;
                        setObInstallments(copy);
                      }}
                      className="rounded-xl px-2.5 py-1.5 text-xs border border-[#7A9E7E]/30 bg-transparent"
                    />
                    <DDMMYYYYInput
                      value={inst.dueDate}
                      onChange={(iso) => {
                        const copy = [...obInstallments];
                        copy[idx].dueDate = iso;
                        setObInstallments(copy);
                      }}
                      className="rounded-xl px-2.5 py-1.5 text-xs border border-[#7A9E7E]/30 bg-transparent"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold opacity-70 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Create Obligation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add to Reserved Amount (Allocation only, NOT an expense) */}
      {activeModal === 'RESERVE_OB' && selectedOb && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 border ${
              darkMode
                ? 'bg-[#001A23] border-[#31493C] text-[#E8F1F2]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            <h3 className="text-lg font-extrabold mb-1">Add to Reserved Amount</h3>
            <p className="text-xs opacity-75 mb-4">
              Allocates existing money toward <strong>{selectedOb.title}</strong>. This is NOT an expense and does not reduce your total money owned.
            </p>
            <form onSubmit={handleReserveObSubmit} className="space-y-3">
              <div className="flex gap-2">
                {(['ADD', 'SET'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setReserveMode(m)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      reserveMode === m
                        ? 'bg-[#31493C] text-[#B3EFB2]'
                        : 'bg-[#7A9E7E]/15 opacity-75'
                    }`}
                  >
                    {m === 'ADD' ? 'Add Amount (+)' : 'Set Exact Total'}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Amount (৳)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={reserveAmtInput}
                  onChange={(e) => setReserveAmtInput(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Wallet Being Allocated From</label>
                <select
                  value={reserveWalletId}
                  onChange={(e) => setReserveWalletId(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                >
                  {data.wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatBDT(w.balance)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold opacity-70 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] cursor-pointer"
                >
                  {submitting ? 'Updating...' : 'Confirm Reserve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Manually Edit Suggested Monthly Reservation Schedule */}
      {activeModal === 'EDIT_PLAN' && selectedOb && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 border ${
              darkMode
                ? 'bg-[#001A23] border-[#31493C] text-[#E8F1F2]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            <h3 className="text-lg font-extrabold mb-1">Adjust Reservation Schedule</h3>
            <p className="text-xs opacity-75 mb-4">
              Customize monthly reservation amounts for <strong>{selectedOb.title}</strong>.
            </p>
            <form onSubmit={handleSaveCustomPlan} className="space-y-3">
              {editSchedule.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold">{item.label}</span>
                  <input
                    type="number"
                    min="0"
                    value={item.amount}
                    onChange={(e) => {
                      const copy = [...editSchedule];
                      copy[idx].amount = e.target.value;
                      setEditSchedule(copy);
                    }}
                    className="w-36 rounded-xl px-3 py-1.5 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold opacity-70 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] cursor-pointer"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Record Actual Payment (Logs Expense & Deducts Wallet) */}
      {activeModal === 'PAY_OB' && selectedOb && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 border ${
              darkMode
                ? 'bg-[#001A23] border-[#31493C] text-[#E8F1F2]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            <h3 className="text-lg font-extrabold mb-1">Record Payment: {selectedOb.title}</h3>
            <p className="text-xs opacity-75 mb-4">
              Decreases wallet balance, reduces outstanding & reserved amounts, and records an expense transaction.
            </p>
            <form onSubmit={handlePayObSubmit} className="space-y-3">
              {selectedOb.installments.length > 0 && (
                <div>
                  <label className="text-xs font-semibold block mb-1">Installment (Optional)</label>
                  <select
                    value={payInstallmentId}
                    onChange={(e) => setPayInstallmentId(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                  >
                    <option value="">General Obligation Payment</option>
                    {selectedOb.installments
                      .filter((i) => !i.isPaid)
                      .map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.title} ({formatBDT(inst.amount - inst.paidAmount)} remaining)
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Amount Paid (৳)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={payAmountInput}
                    onChange={(e) => setPayAmountInput(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Wallet Used</label>
                  <select
                    value={payWalletId}
                    onChange={(e) => setPayWalletId(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                  >
                    {data.wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatBDT(w.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Payment Date (dd/mm/yyyy)</label>
                  <DDMMYYYYInput
                    required
                    value={payDateInput}
                    onChange={setPayDateInput}
                    className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Note (Optional)</label>
                  <input
                    type="text"
                    placeholder="Receipt # or note"
                    value={payNoteInput}
                    onChange={(e) => setPayNoteInput(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold opacity-70 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] cursor-pointer"
                >
                  {submitting ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Create Flexible Savings Entry */}
      {activeModal === 'CREATE_SAVINGS' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 border ${
              darkMode
                ? 'bg-[#001A23] border-[#31493C] text-[#E8F1F2]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            <h3 className="text-lg font-extrabold mb-1">New Savings Entry</h3>
            <p className="text-xs opacity-75 mb-4">
              Optional and 100% user-controlled—no mandatory schedule or automatic deductions.
            </p>
            <form onSubmit={handleCreateSavingsSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Savings Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Japan Trip, New Laptop, Emergency Funds"
                  value={savName}
                  onChange={(e) => setSavName(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Initial Amount (৳)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={savInitial}
                    onChange={(e) => setSavInitial(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Optional Target (৳)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Optional"
                    value={savTarget}
                    onChange={(e) => setSavTarget(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold opacity-70 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] cursor-pointer"
                >
                  Create Savings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Savings Deposit / Withdraw / Edit Balance */}
      {activeModal === 'SAVINGS_ACTION' && selectedSavings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 border ${
              darkMode
                ? 'bg-[#001A23] border-[#31493C] text-[#E8F1F2]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            <h3 className="text-lg font-extrabold mb-1">
              {savActionMode === 'DEPOSIT'
                ? `Add Money to ${selectedSavings.name}`
                : savActionMode === 'WITHDRAW'
                ? `Withdraw from ${selectedSavings.name}`
                : `Edit Balance: ${selectedSavings.name}`}
            </h3>
            <form onSubmit={handleSavingsActionSubmit} className="space-y-3 mt-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Amount (৳)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={savActionAmount}
                  onChange={(e) => setSavActionAmount(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                />
              </div>
              {savActionMode !== 'EDIT_BALANCE' && (
                <div>
                  <label className="text-xs font-semibold block mb-1">Reference Wallet</label>
                  <select
                    value={savActionWalletId}
                    onChange={(e) => setSavActionWalletId(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                  >
                    {data.wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatBDT(w.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold block mb-1">Note (Optional)</label>
                <input
                  type="text"
                  placeholder="Optional note"
                  value={savActionNote}
                  onChange={(e) => setSavActionNote(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm border border-[#7A9E7E]/30 bg-transparent outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold opacity-70 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: Savings Transaction History */}
      {activeModal === 'SAVINGS_HISTORY' && selectedSavings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 border max-h-[85vh] overflow-y-auto ${
              darkMode
                ? 'bg-[#001A23] border-[#31493C] text-[#E8F1F2]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            <h3 className="text-lg font-extrabold mb-1">{selectedSavings.name} — History</h3>
            <p className="text-xs opacity-70 mb-4">
              Current Balance: <strong>{formatBDT(selectedSavings.currentBalance)}</strong>
            </p>
            <div className="space-y-2">
              {selectedSavings.transactions.length === 0 ? (
                <p className="text-xs opacity-65">No history recorded yet.</p>
              ) : (
                selectedSavings.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-2.5 rounded-xl border border-[#7A9E7E]/20 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold block">{tx.note || tx.type}</span>
                      <span className="opacity-65 text-[11px]">{formatDateDDMMYYYY(tx.date)}</span>
                    </div>
                    <span className="font-extrabold">
                      {tx.type === 'DEPOSIT' ? '+' : tx.type === 'EDIT' ? '=' : '-'}
                      {formatBDT(tx.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
