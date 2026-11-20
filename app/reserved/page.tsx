'use client';

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
} from 'lucide-react';

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

interface ObligationItem {
  id: string;
  title: string;
  totalAmount: number;
  reservedAmount: number;
  paidAmount: number;
  dueDate: string;
  category: string;
  notes?: string | null;
  isPaid: boolean;
  installments: ObligationInstallmentItem[];
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
    availableToSpend: number;
  };
  wallets: WalletItem[];
  obligations: ObligationItem[];
  savingsGoals: SavingsGoalItem[];
}

function DDMMYYYYInput({
  value,
  onChange,
  required = false,
  className = '',
  placeholder = 'dd/mm/yyyy',
}: {
  value: string;
  onChange: (isoDate: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const isoToDisplay = (iso: string) => {
    if (!iso) return '';
    const parts = iso.split('T')[0].split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const [text, setText] = useState(() => isoToDisplay(value));

  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    setText(formatted);

    if (digits.length === 8) {
      onChange(`${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`);
    } else if (digits.length === 0) {
      onChange('');
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={10}
      required={required}
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      pattern="\d{2}/\d{2}/\d{4}"
      title="Enter date as dd/mm/yyyy"
      className={className}
    />
  );
}

export default function ReservedManagementPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [nowMs, setNowMs] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  const [activeModal, setActiveModal] = useState<
    | 'OBLIGATION'
    | 'RESERVE_OB'
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
  const [obNotes, setObNotes] = useState('');
  const [obInstallments, setObInstallments] = useState<
    Array<{ title: string; amount: string; dueDate: string }>
  >([]);

  // Reserve / Pay Obligation State
  const [selectedOb, setSelectedOb] = useState<ObligationItem | null>(null);
  const [reserveAmtInput, setReserveAmtInput] = useState('');
  const [reserveMode, setReserveMode] = useState<'ADD' | 'SET'>('ADD');
  const [payInstallmentId, setPayInstallmentId] = useState('');
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payWalletId, setPayWalletId] = useState('');
  const [payDateInput, setPayDateInput] = useState('');
  const [payNoteInput, setPayNoteInput] = useState('');

  // Savings State
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
    setNowMs(Date.now());
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
        category: 'OBLIGATION',
        notes: obNotes,
        installments: obInstallments,
      }),
    });
    setObTitle('');
    setObAmount('');
    setObInitialReserved('');
    setObDueDate('');
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
      }),
    });
    setReserveAmtInput('');
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
        walletId: payWalletId || data?.wallets[0]?.id,
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
  const totalOutOb = Math.max(0, totalReq - totalPaidOb);
  const totalSaved = (data.savingsGoals || []).reduce((s, g) => s + g.currentBalance, 0);

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        darkMode ? 'bg-black text-[#E8F1F2]' : 'bg-[#E8F1F2] text-[#001A23]'
      }`}
    >
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md ${
          darkMode ? 'bg-black/90 border-[#31493C]' : 'bg-[#E8F1F2]/90 border-[#7A9E7E]/25'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] hover:opacity-90"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight">
                Reserved Funds & Savings Manager
              </h1>
              <p className="text-[11px] opacity-70">
                Full view of all obligations, installments, savings entries, and emergency funds
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

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Top Balance Overview Bar */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl p-4 bg-[#31493C] text-[#E8F1F2]">
            <span className="text-[11px] opacity-75 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#B3EFB2]" /> Available to Spend
            </span>
            <p className="text-xl font-extrabold text-[#B3EFB2] mt-1">
              {formatBDT(data.summary.availableToSpend)}
            </p>
          </div>
          <div
            className={`rounded-2xl p-4 border ${
              darkMode ? 'bg-[#31493C]/30 border-[#31493C]' : 'bg-white border-[#7A9E7E]/25'
            }`}
          >
            <span className="text-[11px] opacity-70 block">Reserved for Obligations</span>
            <p className="text-xl font-extrabold text-[#D52073] mt-1">{formatBDT(totalResOb)}</p>
          </div>
          <div
            className={`rounded-2xl p-4 border ${
              darkMode ? 'bg-[#31493C]/30 border-[#31493C]' : 'bg-white border-[#7A9E7E]/25'
            }`}
          >
            <span className="text-[11px] opacity-70 block">Reserved in Savings</span>
            <p className="text-xl font-extrabold text-[#7A9E7E] mt-1">{formatBDT(totalSaved)}</p>
          </div>
          <div
            className={`rounded-2xl p-4 border ${
              darkMode ? 'bg-[#31493C]/30 border-[#31493C]' : 'bg-white border-[#7A9E7E]/25'
            }`}
          >
            <span className="text-[11px] opacity-70 block">Total Owned Across Wallets</span>
            <p className="text-xl font-extrabold mt-1">{formatBDT(data.summary.totalBalance)}</p>
          </div>
        </section>

        {/* Two Main Categories Side-by-Side (Full Unclipped Listings) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Category 1: All Reserved Obligations */}
          <div
            className={`rounded-3xl p-5 border ${
              darkMode
                ? 'bg-[#31493C]/30 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-[#D52073]" />
                1. Reserved Obligations ({data.obligations.length})
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal('OBLIGATION')}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#FFEF5C] text-[#001A23] hover:brightness-95 cursor-pointer"
              >
                + New Obligation
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs p-3 rounded-2xl bg-black/5 dark:bg-white/5 mb-4">
              <div>
                <span className="opacity-70 block text-[11px]">Total Required</span>
                <strong>{formatBDT(totalReq)}</strong>
              </div>
              <div>
                <span className="opacity-70 block text-[11px]">Reserved</span>
                <strong className="text-[#7A9E7E]">{formatBDT(totalResOb)}</strong>
              </div>
              <div>
                <span className="opacity-70 block text-[11px]">Already Paid</span>
                <strong>{formatBDT(totalPaidOb)}</strong>
              </div>
              <div>
                <span className="opacity-70 block text-[11px]">Remaining</span>
                <strong className="text-[#D52073]">{formatBDT(totalOutOb)}</strong>
              </div>
            </div>

            <div className="space-y-3.5">
              {data.obligations.length === 0 ? (
                <p className="text-xs opacity-60 py-6 text-center">No obligations added yet.</p>
              ) : (
                data.obligations.map((ob) => {
                  const remainingToPay = Math.max(0, ob.totalAmount - ob.paidAmount);
                  const remainingToReserve = Math.max(0, remainingToPay - ob.reservedAmount);
                  const isOverdue =
                    !ob.isPaid && nowMs > 0 && new Date(ob.dueDate).getTime() < nowMs;
                  const statusLabel = ob.isPaid
                    ? 'Paid'
                    : isOverdue
                    ? 'Overdue'
                    : ob.reservedAmount >= remainingToPay && remainingToPay > 0
                    ? 'Fully Reserved'
                    : ob.reservedAmount > 0
                    ? 'Partially Reserved'
                    : 'Not Reserved';

                  return (
                    <div
                      key={ob.id}
                      className={`p-4 rounded-2xl border space-y-2.5 ${
                        darkMode
                          ? 'bg-black/60 border-[#31493C]'
                          : 'bg-[#E8F1F2]/60 border-[#7A9E7E]/20'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold">{ob.title}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                ob.isPaid
                                  ? 'bg-[#B3EFB2] text-[#001A23]'
                                  : isOverdue
                                  ? 'bg-[#D52073] text-white'
                                  : ob.reservedAmount >= remainingToPay
                                  ? 'bg-[#7A9E7E] text-white'
                                  : 'bg-[#FFEF5C] text-[#001A23]'
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          <p className="text-xs opacity-75 mt-0.5">
                            Deadline: {formatDateDDMMYYYY(ob.dueDate)}
                            {ob.notes ? ` • ${ob.notes}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteObligation(ob.id)}
                          title="Delete obligation"
                          className="text-[#D52073] opacity-70 hover:opacity-100 cursor-pointer p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <span>
                          Total Required: <strong>{formatBDT(ob.totalAmount)}</strong>
                        </span>
                        <span>
                          Reserved: <strong className="text-[#7A9E7E]">{formatBDT(ob.reservedAmount)}</strong>
                        </span>
                        <span>
                          Already Paid: <strong>{formatBDT(ob.paidAmount)}</strong>
                        </span>
                        <span>
                          Remaining: <strong className="text-[#D52073]">{formatBDT(remainingToPay)}</strong>
                        </span>
                      </div>

                      {!ob.isPaid && remainingToReserve > 0 && (
                        <p className="text-[11px] opacity-75">
                          Remaining to reserve: <strong>{formatBDT(remainingToReserve)}</strong>
                        </p>
                      )}

                      {ob.installments && ob.installments.length > 0 && (
                        <div className="space-y-1 pt-2 border-t border-[#7A9E7E]/20">
                          <p className="text-[10px] font-bold uppercase opacity-65">
                            Installment Schedule
                          </p>
                          {ob.installments.map((inst) => {
                            const instRem = Math.max(0, inst.amount - inst.paidAmount);
                            return (
                              <div
                                key={inst.id}
                                className="flex items-center justify-between text-xs py-0.5"
                              >
                                <span>
                                  {inst.title} ({formatDateDDMMYYYY(inst.dueDate)})
                                </span>
                                <span
                                  className={
                                    inst.isPaid ? 'text-[#7A9E7E] font-bold' : 'font-semibold'
                                  }
                                >
                                  {inst.isPaid
                                    ? `Paid (${formatBDT(inst.amount)})`
                                    : `${formatBDT(instRem)} due`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!ob.isPaid && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOb(ob);
                              setReserveMode('ADD');
                              setReserveAmtInput('');
                              setActiveModal('RESERVE_OB');
                            }}
                            className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border border-[#31493C] dark:border-[#B3EFB2]/50 hover:bg-[#7A9E7E]/15 cursor-pointer"
                          >
                            + Reserve Money
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOb(ob);
                              const nextInst = ob.installments?.find((i) => !i.isPaid);
                              setPayInstallmentId(nextInst ? nextInst.id : '');
                              setPayAmountInput(
                                nextInst
                                  ? String(Math.max(0, nextInst.amount - nextInst.paidAmount))
                                  : String(remainingToPay)
                              );
                              setPayWalletId(data.wallets[0]?.id || '');
                              setPayDateInput(new Date().toISOString().split('T')[0]);
                              setPayNoteInput('');
                              setActiveModal('PAY_OB');
                            }}
                            className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] hover:opacity-90 cursor-pointer"
                          >
                            Record Payment
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Category 2: All Savings & Emergency Funds */}
          <div
            className={`rounded-3xl p-5 border ${
              darkMode
                ? 'bg-[#31493C]/30 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Vault className="w-5 h-5 text-[#7A9E7E]" />
                2. Savings & Emergency Funds ({(data.savingsGoals || []).length})
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal('CREATE_SAVINGS')}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#B3EFB2] text-[#001A23] hover:brightness-95 cursor-pointer"
              >
                + New Savings
              </button>
            </div>

            <div className="text-xs p-3 rounded-2xl bg-black/5 dark:bg-white/5 mb-4 flex justify-between items-center">
              <span>Total Money Currently Saved Across All Entries:</span>
              <strong className="text-sm text-[#7A9E7E]">{formatBDT(totalSaved)}</strong>
            </div>

            <div className="space-y-3.5">
              {!data.savingsGoals || data.savingsGoals.length === 0 ? (
                <p className="text-xs opacity-60 py-6 text-center">
                  No savings entries yet. Add Emergency Funds, Japan Trip, or any custom goal.
                </p>
              ) : (
                data.savingsGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className={`p-4 rounded-2xl border space-y-2.5 ${
                      darkMode
                        ? 'bg-black/60 border-[#31493C]'
                        : 'bg-[#E8F1F2]/60 border-[#7A9E7E]/20'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-bold text-sm">{goal.name}</div>
                        <div className="text-xs opacity-80 mt-0.5">
                          Current Saved Balance:{' '}
                          <strong className="text-[#7A9E7E]">{formatBDT(goal.currentBalance)}</strong>
                          {goal.targetAmount ? ` • Optional Target: ${formatBDT(goal.targetAmount)}` : ''}
                          {goal.targetDate ? ` • Target Date: ${formatDateDDMMYYYY(goal.targetDate)}` : ''}
                        </div>
                        {goal.notes && <p className="text-xs opacity-65 mt-0.5">{goal.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSavings(goal);
                            setActiveModal('SAVINGS_HISTORY');
                          }}
                          title="View transaction history"
                          className="p-1.5 rounded-lg hover:bg-[#7A9E7E]/20 cursor-pointer"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavings(goal.id)}
                          title="Delete savings entry"
                          className="p-1.5 rounded-lg text-[#D52073] opacity-75 hover:opacity-100 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
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
                        className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] cursor-pointer"
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
                        className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border border-[#31493C] dark:border-[#B3EFB2]/40 cursor-pointer"
                      >
                        Withdraw / Spend
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
                        className="py-1.5 px-3 rounded-xl text-xs font-semibold opacity-75 hover:opacity-100 cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Create Obligation Modal */}
      {activeModal === 'OBLIGATION' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`w-full max-w-lg rounded-3xl p-6 shadow-xl border my-8 ${
              darkMode
                ? 'bg-black border-[#31493C] text-[#E8F1F2]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            <h3 className="font-bold text-lg mb-1">New Reserved Obligation</h3>
            <p className="text-xs opacity-70 mb-4">
              Track upcoming fees, rent, or installments. Reserving money does not count as an expense until you confirm payment.
            </p>
            <form onSubmit={handleObligationSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold block mb-1">Obligation Name</label>
                <input
                  type="text"
                  required
                  value={obTitle}
                  onChange={(e) => setObTitle(e.target.value)}
                  placeholder="e.g. University Trimester Fee"
                  className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Total Required (৳)</label>
                  <input
                    type="number"
                    required
                    value={obAmount}
                    onChange={(e) => setObAmount(e.target.value)}
                    placeholder="30000"
                    className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Currently Reserved (৳)</label>
                  <input
                    type="number"
                    value={obInitialReserved}
                    onChange={(e) => setObInitialReserved(e.target.value)}
                    placeholder="10000"
                    className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Deadline (dd/mm/yyyy)</label>
                  <DDMMYYYYInput
                    required
                    value={obDueDate}
                    onChange={setObDueDate}
                    className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={obNotes}
                    onChange={(e) => setObNotes(e.target.value)}
                    placeholder="Optional note"
                    className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold">Installment Schedule (Optional)</label>
                  <button
                    type="button"
                    onClick={() =>
                      setObInstallments([
                        ...obInstallments,
                        {
                          title: `Installment ${obInstallments.length + 1}`,
                          amount: '',
                          dueDate: obDueDate || '',
                        },
                      ])
                    }
                    className="text-xs font-bold text-[#7A9E7E] cursor-pointer"
                  >
                    + Add Installment
                  </button>
                </div>
                {obInstallments.map((inst, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                    <input
                      type="text"
                      value={inst.title}
                      onChange={(e) => {
                        const copy = [...obInstallments];
                        copy[idx].title = e.target.value;
                        setObInstallments(copy);
                      }}
                      placeholder="Name"
                      className="col-span-4 px-2.5 py-1.5 rounded-lg border bg-transparent text-xs"
                    />
                    <input
                      type="number"
                      value={inst.amount}
                      onChange={(e) => {
                        const copy = [...obInstallments];
                        copy[idx].amount = e.target.value;
                        setObInstallments(copy);
                      }}
                      placeholder="Amount ৳"
                      className="col-span-3 px-2.5 py-1.5 rounded-lg border bg-transparent text-xs"
                    />
                    <DDMMYYYYInput
                      value={inst.dueDate}
                      onChange={(val) => {
                        const copy = [...obInstallments];
                        copy[idx].dueDate = val;
                        setObInstallments(copy);
                      }}
                      className="col-span-4 px-2.5 py-1.5 rounded-lg border bg-transparent text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setObInstallments(obInstallments.filter((_, i) => i !== idx))}
                      className="col-span-1 text-[#D52073] flex justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#FFEF5C] text-[#001A23] cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Create Obligation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Reserved Money Modal */}
      {activeModal === 'RESERVE_OB' && selectedOb && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-xl border ${
              darkMode
                ? 'bg-black border-[#31493C] text-[#E8F1F2]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            <h3 className="font-bold text-lg mb-1">Update Reserved Funds</h3>
            <p className="text-xs opacity-75 mb-4">
              {selectedOb.title} • Currently Reserved:{' '}
              <strong>{formatBDT(selectedOb.reservedAmount)}</strong>
            </p>
            <form onSubmit={handleReserveObSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReserveMode('ADD')}
                  className={`py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    reserveMode === 'ADD'
                      ? 'bg-[#31493C] text-[#B3EFB2]'
                      : 'bg-[#E8F1F2] text-[#001A23]'
                  }`}
                >
                  Add to Reserve
                </button>
                <button
                  type="button"
                  onClick={() => setReserveMode('SET')}
                  className={`py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    reserveMode === 'SET'
                      ? 'bg-[#31493C] text-[#B3EFB2]'
                      : 'bg-[#E8F1F2] text-[#001A23]'
                  }`}
                >
                  Set Exact Reserve
                </button>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">
                  {reserveMode === 'ADD' ? 'Amount to Add (৳)' : 'New Reserved Amount (৳)'}
                </label>
                <input
                  type="number"
                  required
                  value={reserveAmtInput}
                  onChange={(e) => setReserveAmtInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-transparent text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
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
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#FFEF5C] text-[#001A23] cursor-pointer"
                >
                  {submitting ? 'Updating...' : 'Update Reserve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {activeModal === 'PAY_OB' && selectedOb && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-xl border ${
              darkMode
                ? 'bg-black border-[#31493C] text-[#E8F1F2]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            <h3 className="font-bold text-lg mb-1">Record Obligation Payment</h3>
            <p className="text-xs opacity-75 mb-4">
              Deducts from your chosen wallet, reduces reserved funds, and records an expense.
            </p>
            <form onSubmit={handlePayObSubmit} className="space-y-3.5">
              {selectedOb.installments && selectedOb.installments.length > 0 && (
                <div>
                  <label className="text-xs font-semibold block mb-1">Select Installment</label>
                  <select
                    value={payInstallmentId}
                    onChange={(e) => {
                      setPayInstallmentId(e.target.value);
                      const found = selectedOb.installments.find((i) => i.id === e.target.value);
                      if (found)
                        setPayAmountInput(String(Math.max(0, found.amount - found.paidAmount)));
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                  >
                    <option value="" className="text-[#001A23]">
                      General Obligation Payment
                    </option>
                    {selectedOb.installments
                      .filter((i) => !i.isPaid)
                      .map((inst) => (
                        <option key={inst.id} value={inst.id} className="text-[#001A23]">
                          {inst.title} — {formatBDT(inst.amount - inst.paidAmount)} due (
                          {formatDateDDMMYYYY(inst.dueDate)})
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
                    value={payAmountInput}
                    onChange={(e) => setPayAmountInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Payment Date (dd/mm/yyyy)
                  </label>
                  <DDMMYYYYInput
                    required
                    value={payDateInput}
                    onChange={setPayDateInput}
                    className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Paid From Wallet</label>
                <select
                  value={payWalletId}
                  onChange={(e) => setPayWalletId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                >
                  {data.wallets.map((w) => (
                    <option key={w.id} value={w.id} className="text-[#001A23]">
                      {w.name} ({formatBDT(w.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">
                  Note / Reference (Optional)
                </label>
                <input
                  type="text"
                  value={payNoteInput}
                  onChange={(e) => setPayNoteInput(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] cursor-pointer"
                >
                  {submitting ? 'Confirming...' : 'Confirm & Mark Paid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Savings Modal */}
      {activeModal === 'CREATE_SAVINGS' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-xl border ${
              darkMode
                ? 'bg-black border-[#31493C] text-[#E8F1F2]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            <h3 className="font-bold text-lg mb-1">New Savings Entry</h3>
            <p className="text-xs opacity-70 mb-4">
              Create any custom savings entry (e.g. Japan Trip, New Laptop, Emergency Funds).
            </p>
            <form onSubmit={handleCreateSavingsSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold block mb-1">Savings Name</label>
                <input
                  type="text"
                  required
                  value={savName}
                  onChange={(e) => setSavName(e.target.value)}
                  placeholder="e.g. Japan Trip, Emergency Funds"
                  className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Initial Reserved (৳)</label>
                  <input
                    type="number"
                    value={savInitial}
                    onChange={(e) => setSavInitial(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Optional Target (৳)</label>
                  <input
                    type="number"
                    value={savTarget}
                    onChange={(e) => setSavTarget(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Target Date (dd/mm/yyyy)
                  </label>
                  <DDMMYYYYInput
                    value={savTargetDate}
                    onChange={setSavTargetDate}
                    className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={savNotes}
                    onChange={(e) => setSavNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
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
                  {submitting ? 'Saving...' : 'Create Savings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Savings Action Modal */}
      {activeModal === 'SAVINGS_ACTION' && selectedSavings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-xl border ${
              darkMode
                ? 'bg-black border-[#31493C] text-[#E8F1F2]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            <h3 className="font-bold text-lg mb-1">{selectedSavings.name}</h3>
            <p className="text-xs opacity-75 mb-4">
              Current Saved Balance: <strong>{formatBDT(selectedSavings.currentBalance)}</strong>
            </p>
            <form onSubmit={handleSavingsActionSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'DEPOSIT', label: '+ Add Money' },
                  { id: 'WITHDRAW', label: 'Move Back to Wallet' },
                  { id: 'SPEND', label: 'Spend as Expense' },
                  { id: 'EDIT_BALANCE', label: 'Edit Balance' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSavActionMode(tab.id as typeof savActionMode)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                      savActionMode === tab.id
                        ? 'bg-[#31493C] text-[#B3EFB2]'
                        : 'bg-[#E8F1F2] text-[#001A23]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">
                  {savActionMode === 'EDIT_BALANCE' ? 'New Saved Balance (৳)' : 'Amount (৳)'}
                </label>
                <input
                  type="number"
                  required
                  value={savActionAmount}
                  onChange={(e) => setSavActionAmount(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                />
              </div>

              {(savActionMode === 'WITHDRAW' || savActionMode === 'SPEND') && (
                <div>
                  <label className="text-xs font-semibold block mb-1">
                    {savActionMode === 'WITHDRAW' ? 'Return to Wallet' : 'Payment Wallet'}
                  </label>
                  <select
                    value={savActionWalletId}
                    onChange={(e) => setSavActionWalletId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                  >
                    {data.wallets.map((w) => (
                      <option key={w.id} value={w.id} className="text-[#001A23]">
                        {w.name} ({formatBDT(w.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {savActionMode === 'SPEND' && (
                <div>
                  <label className="text-xs font-semibold block mb-1">Expense Category</label>
                  <select
                    value={savActionCategory}
                    onChange={(e) => setSavActionCategory(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                  >
                    <option value="Shopping" className="text-[#001A23]">Shopping</option>
                    <option value="Travel" className="text-[#001A23]">Travel</option>
                    <option value="Emergency" className="text-[#001A23]">Emergency</option>
                    <option value="Education" className="text-[#001A23]">Education</option>
                    <option value="Tech & Gadgets" className="text-[#001A23]">Tech & Gadgets</option>
                    <option value="Food" className="text-[#001A23]">Food</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold block mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={savActionNote}
                  onChange={(e) => setSavActionNote(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border bg-transparent text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
                  {submitting ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Savings History Modal */}
      {activeModal === 'SAVINGS_HISTORY' && selectedSavings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-xl border ${
              darkMode
                ? 'bg-black border-[#31493C] text-[#E8F1F2]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-lg">{selectedSavings.name} — History</h3>
                <p className="text-xs opacity-70">
                  Current Saved Balance: {formatBDT(selectedSavings.currentBalance)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {selectedSavings.transactions.length === 0 ? (
                <p className="text-xs opacity-60 py-4 text-center">No transactions recorded yet.</p>
              ) : (
                selectedSavings.transactions.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-black/5 dark:bg-white/5"
                  >
                    <div>
                      <span className="font-bold">
                        {st.type === 'DEPOSIT'
                          ? 'Added to Savings'
                          : st.type === 'WITHDRAW'
                          ? 'Moved Back to Wallet'
                          : st.type === 'SPEND'
                          ? 'Spent as Expense'
                          : 'Balance Adjusted'}
                      </span>
                      <p className="text-[11px] opacity-70">
                        {formatDateDDMMYYYY(st.date)}
                        {st.note ? ` • ${st.note}` : ''}
                      </p>
                    </div>
                    <span
                      className={`font-bold ${
                        st.type === 'DEPOSIT' ? 'text-[#7A9E7E]' : 'text-[#D52073]'
                      }`}
                    >
                      {st.type === 'DEPOSIT' ? '+' : '-'}
                      {formatBDT(st.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
