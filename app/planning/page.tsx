'use client';

/**
 * @file app/planning/page.tsx
 * @description Budgets, loans, savings goals, and purchase readiness planning workspace.
 */

import DDMMYYYYInput from '@/components/DDMMYYYYInput';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sun,
  Moon,
  Plus,
  Trash2,
  CheckCircle2,
  PieChart,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  AlertTriangle,
} from 'lucide-react';

interface WalletItem {
  id: string;
  name: string;
  balance: number;
}

interface ExpectedIncomeItem {
  id: string;
  title: string;
  sourceType: string;
  amount: number;
  expectedDate: string;
  isRecurring: boolean;
  isReceived: boolean;
  receivedAmount: number;
  targetWalletId?: string | null;
  notes?: string | null;
}

interface BudgetItem {
  id: string;
  category: string;
  monthlyLimit: number;
  adjustedLimit: number;
  spent: number;
  remaining: number;
  usagePercent: number;
  isFlexible: boolean;
  isOverspent: boolean;
  isNearLimit: boolean;
  notes?: string | null;
}

interface LoanPaymentItem {
  id: string;
  amount: number;
  date: string;
  walletName?: string | null;
  note?: string | null;
}

interface LoanItem {
  id: string;
  direction: 'BORROWED' | 'LENT';
  title: string;
  lender?: string | null;
  principal: number;
  remaining: number;
  monthlyEmi: number;
  nextDueDate: string;
  notes?: string | null;
  isClosed: boolean;
  payments: LoanPaymentItem[];
}

interface PlanningData {
  wallets: WalletItem[];
  expectedIncomes: ExpectedIncomeItem[];
  budgets: BudgetItem[];
  loans: LoanItem[];
  summary: {
    availableToSpend: number;
    pendingExpectedIncome30: number;
    totalLoanRemaining: number;
    totalLentRemaining: number;
  };
}


export default function PlanningWorkspacePage() {
  const [data, setData] = useState<PlanningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Expected Income Form
  const [eiTitle, setEiTitle] = useState('');
  const [eiSourceType, setEiSourceType] = useState('FIXED');
  const [eiAmount, setEiAmount] = useState('');
  const [eiDate, setEiDate] = useState('');
  const [eiRecurring, setEiRecurring] = useState(false);
  const [eiWalletId, setEiWalletId] = useState('');

  // Budget Form
  const [budCategory, setBudCategory] = useState('Food');
  const [budLimit, setBudLimit] = useState('');
  const [budFlexible, setBudFlexible] = useState(true);

  // Loan Form (BORROWED or LENT)
  const [loanDirection, setLoanDirection] = useState<'BORROWED' | 'LENT'>('BORROWED');
  const [loanTitle, setLoanTitle] = useState('');
  const [loanParty, setLoanParty] = useState('');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanEmi, setLoanEmi] = useState('');
  const [loanDueDate, setLoanDueDate] = useState('');
  const [historyLoan, setHistoryLoan] = useState<LoanItem | null>(null);

  const formatBDT = (num: number) => `৳${Math.round(num).toLocaleString('en-IN')}`;
  const formatDateDDMMYYYY = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}/${d.getFullYear()}`;
  };

  const fetchData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      if (res.ok && json) {
        setData(json);
        if (json.wallets?.length > 0 && !eiWalletId) {
          setEiWalletId(json.wallets[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddExpectedIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eiTitle.trim() || !eiAmount || !eiDate) return;
    setSubmitting(true);
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CREATE_EXPECTED_INCOME',
        title: eiTitle,
        sourceType: eiSourceType,
        amount: Number(eiAmount),
        expectedDate: eiDate,
        isRecurring: eiRecurring,
        targetWalletId: eiWalletId,
      }),
    });
    setEiTitle('');
    setEiAmount('');
    setEiDate('');
    setEiRecurring(false);
    setSubmitting(false);
    fetchData();
  };

  const handleReceiveIncome = async (ei: ExpectedIncomeItem) => {
    setSubmitting(true);
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RECEIVE_EXPECTED_INCOME',
        expectedIncomeId: ei.id,
        amount: Math.max(0, ei.amount - ei.receivedAmount),
        walletId: ei.targetWalletId || data?.wallets[0]?.id,
      }),
    });
    setSubmitting(false);
    fetchData();
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budCategory.trim() || !budLimit) return;
    setSubmitting(true);
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SAVE_BUDGET',
        category: budCategory,
        monthlyLimit: Number(budLimit),
        isFlexible: budFlexible,
      }),
    });
    setBudLimit('');
    setSubmitting(false);
    fetchData();
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanTitle.trim() || !loanPrincipal || !loanDueDate) return;
    setSubmitting(true);
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CREATE_LOAN',
        direction: loanDirection,
        title: loanTitle,
        lender: loanParty,
        principal: Number(loanPrincipal),
        monthlyEmi: Number(loanEmi) || Number(loanPrincipal),
        nextDueDate: loanDueDate,
      }),
    });
    setLoanTitle('');
    setLoanParty('');
    setLoanPrincipal('');
    setLoanEmi('');
    setLoanDueDate('');
    setSubmitting(false);
    fetchData();
  };

  const handleRecordLoanPayment = async (loan: LoanItem) => {
    const payAmt = Math.min(loan.remaining, loan.monthlyEmi || loan.remaining);
    setSubmitting(true);
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'PAY_LOAN',
        loanId: loan.id,
        amount: payAmt,
        walletId: data?.wallets[0]?.id,
      }),
    });
    setSubmitting(false);
    fetchData();
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#E8F1F2] text-[#001A23] flex items-center justify-center font-semibold">
        Loading Budgets, Expected Income & Loans...
      </div>
    );
  }

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
                Flexible Budgets, Expected Income & Loans
              </h1>
              <p className="text-[11px] opacity-70">
                Keep expected income separate from received cash, adapt spending limits, and track borrowed/lent money
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
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
        {/* Top Metrics */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl p-4 bg-[#31493C] text-[#E8F1F2]">
            <span className="text-[11px] opacity-75 block">Available to Spend</span>
            <p className="text-xl font-extrabold text-[#B3EFB2] mt-1">
              {formatBDT(data.summary.availableToSpend)}
            </p>
            <span className="text-[10px] opacity-70">Actual confirmed liquid cash</span>
          </div>
          <div
            className={`rounded-2xl p-4 border ${
              darkMode ? 'bg-[#31493C]/20 border-[#31493C]' : 'bg-white border-[#7A9E7E]/25'
            }`}
          >
            <span className="text-[11px] opacity-70 block">Expected Income (Unreceived)</span>
            <p className="text-xl font-extrabold text-[#7A9E7E] mt-1">
              {formatBDT(data.summary.pendingExpectedIncome30)}
            </p>
            <span className="text-[10px] opacity-65">Not added to wallets until received</span>
          </div>
          <div
            className={`rounded-2xl p-4 border ${
              darkMode ? 'bg-[#31493C]/20 border-[#31493C]' : 'bg-white border-[#7A9E7E]/25'
            }`}
          >
            <span className="text-[11px] opacity-70 block">Money Borrowed (I Owe)</span>
            <p className="text-xl font-extrabold text-[#D52073] mt-1">
              {formatBDT(data.summary.totalLoanRemaining)}
            </p>
            <span className="text-[10px] opacity-65">Outstanding debt balance</span>
          </div>
          <div
            className={`rounded-2xl p-4 border ${
              darkMode ? 'bg-[#31493C]/20 border-[#31493C]' : 'bg-white border-[#7A9E7E]/25'
            }`}
          >
            <span className="text-[11px] opacity-70 block">Money Lent (Owed to Me)</span>
            <p className="text-xl font-extrabold text-[#7A9E7E] mt-1">
              {formatBDT(data.summary.totalLentRemaining)}
            </p>
            <span className="text-[10px] opacity-65">Pending repayments from others</span>
          </div>
        </section>

        {/* Row 1: Flexible Budgets & Expected Income */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Flexible Budgets */}
          <div
            className={`rounded-3xl p-5 border ${
              darkMode
                ? 'bg-[#31493C]/20 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-sm'
            }`}
          >
            <h2 className="font-bold text-base flex items-center gap-2 mb-1">
              <PieChart className="w-4 h-4 text-[#D52073]" />
              Flexible Monthly Budgets
            </h2>
            <p className="text-xs opacity-75 mb-4">
              Category spending limits automatically adapt when your monthly income changes
            </p>

            <form onSubmit={handleSaveBudget} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
              <input
                type="text"
                required
                placeholder="Category (e.g., Food)"
                value={budCategory}
                onChange={(e) => setBudCategory(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
              />
              <input
                type="number"
                required
                min="1"
                placeholder="Monthly Limit (৳)"
                value={budLimit}
                onChange={(e) => setBudLimit(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] cursor-pointer"
              >
                Set Budget
              </button>
            </form>

            <div className="space-y-3">
              {data.budgets.map((b) => (
                <div
                  key={b.id}
                  className={`p-3 rounded-2xl border ${
                    darkMode
                      ? 'bg-[#001A23]/50 border-[#31493C]'
                      : 'bg-[#E8F1F2]/50 border-[#7A9E7E]/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold">{b.category}</span>
                    <div className="flex items-center gap-2">
                      <span>
                        <strong>{formatBDT(b.spent)}</strong> / {formatBDT(b.adjustedLimit)}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch('/api/dashboard', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'DELETE_BUDGET', budgetId: b.id }),
                          });
                          fetchData();
                        }}
                        className="opacity-60 hover:opacity-100 hover:text-[#D52073] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-[#7A9E7E]/20 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        b.isOverspent
                          ? 'bg-[#D52073]'
                          : b.isNearLimit
                          ? 'bg-[#FFEF5C]'
                          : 'bg-[#7A9E7E]'
                      }`}
                      style={{ width: `${Math.min(100, b.usagePercent)}%` }}
                    />
                  </div>

                  {b.isOverspent && (
                    <p className="text-[11px] text-[#D52073] font-semibold mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Overspent by{' '}
                      {formatBDT(Math.abs(b.remaining))}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Expected vs. Received Income */}
          <div
            className={`rounded-3xl p-5 border ${
              darkMode
                ? 'bg-[#31493C]/20 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-sm'
            }`}
          >
            <h2 className="font-bold text-base mb-1">Expected vs. Received Income</h2>
            <p className="text-xs opacity-75 mb-4">
              Expected income stays separate from your wallet balance until you confirm it is received
            </p>

            <form onSubmit={handleAddExpectedIncome} className="space-y-2 mb-4">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Source (e.g., Tuition, Freelance)"
                  value={eiTitle}
                  onChange={(e) => setEiTitle(e.target.value)}
                  className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
                />
                <select
                  value={eiSourceType}
                  onChange={(e) => setEiSourceType(e.target.value)}
                  className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
                >
                  <option value="FIXED">Fixed / Salary</option>
                  <option value="FREELANCE">Freelance</option>
                  <option value="IRREGULAR">Irregular / Bonus</option>
                  <option value="BUSINESS">Business</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Amount (৳)"
                  value={eiAmount}
                  onChange={(e) => setEiAmount(e.target.value)}
                  className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
                />
                <DDMMYYYYInput
                  required
                  value={eiDate}
                  onChange={setEiDate}
                  className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] cursor-pointer"
                >
                  + Add Expected
                </button>
              </div>
            </form>

            <div className="space-y-2.5">
              {data.expectedIncomes.map((ei) => (
                <div
                  key={ei.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                    darkMode
                      ? 'bg-[#001A23]/50 border-[#31493C]'
                      : 'bg-[#E8F1F2]/50 border-[#7A9E7E]/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">{ei.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#7A9E7E]/15">
                        {ei.sourceType}
                      </span>
                      {ei.isReceived && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#B3EFB2] text-[#001A23]">
                          Received
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-75 mt-0.5">
                      {formatBDT(ei.amount)} • Expected {formatDateDDMMYYYY(ei.expectedDate)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!ei.isReceived && (
                      <button
                        type="button"
                        onClick={() => handleReceiveIncome(ei)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#31493C] text-[#B3EFB2] cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Confirm Received
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch('/api/dashboard', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'DELETE_EXPECTED_INCOME',
                            expectedIncomeId: ei.id,
                          }),
                        });
                        fetchData();
                      }}
                      className="p-1 opacity-60 hover:opacity-100 hover:text-[#D52073] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Row 2: Borrowed & Lent Loans with Repayment History */}
        <section
          className={`rounded-3xl p-5 border ${
            darkMode
              ? 'bg-[#31493C]/20 border-[#31493C]'
              : 'bg-white border-[#7A9E7E]/25 shadow-sm'
          }`}
        >
          <h2 className="font-bold text-base mb-1">Loans Tracker — Borrowed & Lent</h2>
          <p className="text-xs opacity-75 mb-4">
            Track both money you borrowed and money you lent to others, with partial repayments and full history
          </p>

          <form onSubmit={handleCreateLoan} className="grid grid-cols-1 sm:grid-cols-6 gap-2 mb-4">
            <select
              value={loanDirection}
              onChange={(e) => setLoanDirection(e.target.value as 'BORROWED' | 'LENT')}
              className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
            >
              <option value="BORROWED">Money Borrowed</option>
              <option value="LENT">Money Lent</option>
            </select>
            <input
              type="text"
              required
              placeholder="Title (e.g., Laptop Loan)"
              value={loanTitle}
              onChange={(e) => setLoanTitle(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
            />
            <input
              type="text"
              placeholder={loanDirection === 'BORROWED' ? 'Lender' : 'Borrower'}
              value={loanParty}
              onChange={(e) => setLoanParty(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
            />
            <input
              type="number"
              required
              min="1"
              placeholder="Principal (৳)"
              value={loanPrincipal}
              onChange={(e) => setLoanPrincipal(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
            />
            <DDMMYYYYInput
              required
              value={loanDueDate}
              onChange={setLoanDueDate}
              className="rounded-xl px-3 py-2 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] cursor-pointer flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Entry
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.loans.map((loan) => {
              const isLent = loan.direction === 'LENT';
              return (
                <div
                  key={loan.id}
                  className={`p-4 rounded-2xl border ${
                    darkMode
                      ? 'bg-[#001A23]/50 border-[#31493C]'
                      : 'bg-[#E8F1F2]/50 border-[#7A9E7E]/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isLent
                              ? 'bg-[#B3EFB2] text-[#001A23]'
                              : 'bg-[#D52073]/15 text-[#D52073]'
                          }`}
                        >
                          {isLent ? (
                            <>
                              <ArrowDownLeft className="w-3 h-3" /> LENT
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3" /> BORROWED
                            </>
                          )}
                        </span>
                        <span className="font-bold text-sm">{loan.title}</span>
                      </div>
                      <p className="text-xs opacity-75 mt-1">
                        Remaining: <strong>{formatBDT(loan.remaining)}</strong> of{' '}
                        {formatBDT(loan.principal)} • Due {formatDateDDMMYYYY(loan.nextDueDate)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setHistoryLoan(loan)}
                        className="p-1.5 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
                        title="Repayment history"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      {!loan.isClosed && (
                        <button
                          type="button"
                          onClick={() => handleRecordLoanPayment(loan)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#31493C] text-[#B3EFB2] cursor-pointer"
                        >
                          {isLent ? 'Record Received' : 'Record Repay'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Loan Repayment History Modal */}
      {historyLoan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 border ${
              darkMode
                ? 'bg-[#001A23] border-[#31493C] text-[#E8F1F2]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            <h3 className="text-lg font-extrabold mb-1">{historyLoan.title} — Repayment History</h3>
            <p className="text-xs opacity-70 mb-4">
              Remaining: <strong>{formatBDT(historyLoan.remaining)}</strong>
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {historyLoan.payments.length === 0 ? (
                <p className="text-xs opacity-65">No repayments recorded yet.</p>
              ) : (
                historyLoan.payments.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl border border-[#7A9E7E]/20 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold block">{formatDateDDMMYYYY(p.date)}</span>
                      {p.walletName && <span className="opacity-65 text-[11px]">{p.walletName}</span>}
                    </div>
                    <span className="font-extrabold">{formatBDT(p.amount)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setHistoryLoan(null)}
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
