'use client';
import DDMMYYYYInput from '@/components/DDMMYYYYInput';
import { FX_RATES_FROM_BDT, convertCurrencyAmount, formatCurrency } from '@/lib/format';

/**
 * @file app/page.tsx
 * @description Primary financial command dashboard displaying Safe Spendable Cash, wallets, obligations, savings, impulse simulator, and daily ledger activity.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import AppSidebar from '@/components/AppSidebar';
import AppHeader from '@/components/AppHeader';
import { useThemePreference } from '@/lib/useThemePreference';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Plus,
  Users,
  CalendarClock,
  ShieldCheck,
  Sun,
  Moon,
  Settings,
  CheckCircle2,
  Receipt,
  Sparkles,
  Trash2,
  Pencil,
  PieChart,
  TrendingUp,
  Vault,
  History,
} from 'lucide-react';

interface WalletItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
}

interface TransactionItem {
  id: string;
  type: string;
  amount: number;
  category: string;
  note?: string;
  date: string;
  wallet: WalletItem;
  targetWallet?: WalletItem;
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
  targetWalletId?: string | null;
  isPaid: boolean;
  installments: ObligationInstallmentItem[];
  outstandingTotal?: number;
  remainingToReserve?: number;
  daysRemaining?: number;
  monthsRemaining?: number;
  fundingPlan?: {
    schedule: Array<{ monthIndex: number; label: string; amount: number }>;
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

interface SplitParticipantItem {
  id: string;
  name: string;
  isMe: boolean;
  itemTotal: number;
  vatShare: number;
  finalOwed: number;
  isSettled: boolean;
}

interface BillSplitItem {
  id: string;
  title: string;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  splitMode: string;
  paidByMe: boolean;
  date: string;
  participants: SplitParticipantItem[];
}

interface DashboardData {
  settings?: { currencySymbol?: string; currencyCode?: string; dailySafeThreshold?: number; dailyCrazyThreshold?: number };
  summary: {
    totalBalance: number;
    totalReserved: number;
    totalReservedObligations: number;
    totalReservedSavings: number;
    availableToSpend: number;
    owedByFriends: number;
  };
  wallets: WalletItem[];
  transactions: TransactionItem[];
  obligations: ObligationItem[];
  savingsGoals: SavingsGoalItem[];
  billSplits: BillSplitItem[];
}


const EMPTY_DASHBOARD_DATA: DashboardData = {
  summary: {
    totalBalance: 0,
    totalReserved: 0,
    totalReservedObligations: 0,
    totalReservedSavings: 0,
    availableToSpend: 0,
    owedByFriends: 0,
  },
  wallets: [],
  transactions: [],
  obligations: [],
  savingsGoals: [],
  billSplits: [],
};

export default function PocketQApp() {
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD_DATA);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('pocketq_dashboard_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.transactions)) {
          setData(parsed);
        }
      }
    } catch {}
  }, []);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useThemePreference();
  const [simAmount, setSimAmount] = useState<number>(0);
  const [dailySafeThreshold, setDailySafeThreshold] = useState<number>(200);
  const [dailyCrazyThreshold, setDailyCrazyThreshold] = useState<number>(50);
  const [editingSimLimits, setEditingSimLimits] = useState<boolean>(false);
  const [draftSafeLimit, setDraftSafeLimit] = useState<string>('200');
  const [draftCrazyLimit, setDraftCrazyLimit] = useState<string>('50');
  const [savingSimLimits, setSavingSimLimits] = useState<boolean>(false);
  const [runwayDays, setRunwayDays] = useState<number>(15);
  const [displayCurrencyCode, setDisplayCurrencyCode] = useState<string>('');
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<WalletItem | null>(null);
  const [walletName, setWalletName] = useState("");
  const [walletType, setWalletType] = useState("MFS");
  const [walletBalance, setWalletBalance] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Active Modal
  const [activeModal, setActiveModal] = useState<
    | 'TRANSACTION'
    | 'OBLIGATION'
    | 'RESERVE_OB'
    | 'PAY_OB'
    | 'CREATE_SAVINGS'
    | 'SAVINGS_ACTION'
    | 'SAVINGS_HISTORY'
    | 'SPLIT'
    | null
  >(null);
  const [submitting, setSubmitting] = useState(false);

  // Transaction Form State
  const [txType, setTxType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>('EXPENSE');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txWalletId, setTxWalletId] = useState('');
  const [txTargetWalletId, setTxTargetWalletId] = useState('');

  // Obligation Form State
  const [obTitle, setObTitle] = useState('');
  const [obAmount, setObAmount] = useState('');
  const [obInitialReserved, setObInitialReserved] = useState('');
  const [obDueDate, setObDueDate] = useState('');
  const [obCategory, setObCategory] = useState('TUITION');
  const [obNotes, setObNotes] = useState('');
  const [obInstallments, setObInstallments] = useState<Array<{ title: string; amount: string; dueDate: string }>>([]);

  // Reserve / Pay Obligation Modal State
  const [selectedOb, setSelectedOb] = useState<ObligationItem | null>(null);
  const [reserveAmtInput, setReserveAmtInput] = useState('');
  const [reserveMode, setReserveMode] = useState<'ADD' | 'SET'>('ADD');
  const [payInstallmentId, setPayInstallmentId] = useState('');
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payWalletId, setPayWalletId] = useState('');
  const [payDateInput, setPayDateInput] = useState('');
  const [nowMs, setNowMs] = useState<number>(0);
  const [payNoteInput, setPayNoteInput] = useState('');

  // Savings Form & Action State
  const [savName, setSavName] = useState('');
  const [savInitial, setSavInitial] = useState('');
  const [savTarget, setSavTarget] = useState('');
  const [savTargetDate, setSavTargetDate] = useState('');
  const [savNotes, setSavNotes] = useState('');
  const [selectedSavings, setSelectedSavings] = useState<SavingsGoalItem | null>(null);
  const [savActionMode, setSavActionMode] = useState<'DEPOSIT' | 'WITHDRAW' | 'SPEND' | 'EDIT_BALANCE'>('DEPOSIT');
  const [savActionAmount, setSavActionAmount] = useState('');
  const [savActionWalletId, setSavActionWalletId] = useState('');
  const [savActionCategory, setSavActionCategory] = useState('Shopping');
  const [savActionNote, setSavActionNote] = useState('');

  // Bill Splitter Form State
  const [splitTitle, setSplitTitle] = useState('');
  const [splitMode, setSplitMode] = useState<'ITEMIZED' | 'EQUAL'>('ITEMIZED');
  const [equalTotalBill, setEqualTotalBill] = useState('');
  const [splitVatInput, setSplitVatInput] = useState('');
  const [vatIsPercent, setVatIsPercent] = useState(true);
  const [paidByMe, setPaidByMe] = useState(true);
  const [settleWalletId, setSettleWalletId] = useState("");
  const [splitWalletId, setSplitWalletId] = useState('');
  const [splitPeople, setSplitPeople] = useState([
    { name: 'Me', isMe: true, itemTotal: '', cashGiven: '' },
    { name: 'Friend 1', isMe: false, itemTotal: '', cashGiven: '' },
  ]);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || !Array.isArray(json.transactions)) {
        return;
      }
      setData(json);
        if (json?.settings) {
          const sSafe = typeof json.settings.dailySafeThreshold === 'number' ? json.settings.dailySafeThreshold : 200;
          const sCrazy = typeof json.settings.dailyCrazyThreshold === 'number' ? json.settings.dailyCrazyThreshold : 50;
          setDailySafeThreshold(sSafe);
          setDailyCrazyThreshold(sCrazy);
          setDraftSafeLimit(String(sSafe));
          setDraftCrazyLimit(String(sCrazy));
        }
      if (json.wallets?.length > 0) {
        setTxWalletId((prev) => prev || json.wallets[0].id);
        setSplitWalletId((prev) => prev || json.wallets[0].id);
        if (json.wallets.length > 1) {
          setTxTargetWalletId((prev) => prev || json.wallets[1].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setNowMs(Date.now());
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const baseCurrencyCode = data?.settings?.currencyCode || 'BDT';
  const baseCurrencySymbol = data?.settings?.currencySymbol || '৳';
  const activeCurrencyCode = displayCurrencyCode || baseCurrencyCode;
  const activeCurrencySymbol =
    activeCurrencyCode === baseCurrencyCode
      ? baseCurrencySymbol
      : FX_RATES_FROM_BDT[activeCurrencyCode]?.symbol || activeCurrencyCode;
  const formatBDT = (amount: number) => {
    const converted = convertCurrencyAmount(amount, baseCurrencyCode, activeCurrencyCode);
    return formatCurrency(converted, activeCurrencySymbol);
  };

  // Live Preview Calculation for Bill Splitter
  const computeSplitPreview = () => {
    if (splitMode === 'EQUAL') {
      const total = Number(equalTotalBill) || 0;
      const vat = vatIsPercent
        ? (total * (Number(splitVatInput) || 0)) / 100
        : Number(splitVatInput) || 0;
      const grandTotal = total + vat;
      const count = splitPeople.length || 1;
      const perPersonItem = total / count;
      const perPersonVat = vat / count;
      return {
        subtotal: total,
        vatAmount: vat,
        grandTotal,
        breakdown: splitPeople.map((p) => ({
          name: p.name || 'Friend',
          isMe: p.isMe,
          itemTotal: perPersonItem,
          vatShare: perPersonVat,
          finalOwed: perPersonItem + perPersonVat,
          cashGiven: Number(p.cashGiven) || 0,
        })),
      };
    } else {
      const subtotal = splitPeople.reduce((acc, p) => acc + (Number(p.itemTotal) || 0), 0);
      const vat = vatIsPercent
        ? (subtotal * (Number(splitVatInput) || 0)) / 100
        : Number(splitVatInput) || 0;
      const grandTotal = subtotal + vat;
      return {
        subtotal,
        vatAmount: vat,
        grandTotal,
        breakdown: splitPeople.map((p) => {
          const itemCost = Number(p.itemTotal) || 0;
          const vatShare = subtotal > 0 ? (itemCost / subtotal) * vat : 0;
          return {
            name: p.name || 'Friend',
            isMe: p.isMe,
            itemTotal: itemCost,
            vatShare,
            finalOwed: itemCost + vatShare,
            cashGiven: Number(p.cashGiven) || 0,
          };
        }),
      };
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(txAmount);
    if (!numericAmount || numericAmount <= 0 || !txWalletId) return;

    const capturedType = txType;
    const capturedCategory = capturedType === 'TRANSFER' ? 'Wallet Transfer' : txCategory;
    const capturedNote = txNote;
    const capturedWalletId = txWalletId;
    const capturedTargetWalletId = capturedType === 'TRANSFER' ? txTargetWalletId : null;

    // 1. Instant optimistic UI update so wallet balances & totals reflect immediately
    setData((prev) => {
      const updatedWallets = prev.wallets.map((w) => {
        if (capturedType === 'TRANSFER') {
          if (w.id === capturedWalletId && w.id === capturedTargetWalletId) return w;
          if (w.id === capturedWalletId) return { ...w, balance: w.balance - numericAmount };
          if (w.id === capturedTargetWalletId) return { ...w, balance: w.balance + numericAmount };
          return w;
        }
        if (w.id === capturedWalletId) {
          const delta = capturedType === 'INCOME' ? numericAmount : -numericAmount;
          return { ...w, balance: w.balance + delta };
        }
        return w;
      });

      const balanceDelta =
        capturedType === 'TRANSFER'
          ? 0
          : capturedType === 'INCOME'
          ? numericAmount
          : -numericAmount;

      const sourceWallet = updatedWallets.find((w) => w.id === capturedWalletId) || {
        id: capturedWalletId,
        name: 'Wallet',
        type: 'CASH',
        balance: 0,
        color: '#7A9E7E',
      };
      const targetWallet = capturedTargetWalletId
        ? updatedWallets.find((w) => w.id === capturedTargetWalletId)
        : undefined;

      const optimisticTx: TransactionItem = {
        id: `optimistic-${Date.now()}`,
        type: capturedType,
        amount: numericAmount,
        category: capturedCategory,
        note: capturedNote || undefined,
        date: new Date().toISOString(),
        wallet: sourceWallet,
        targetWallet,
      };

      const nextData: DashboardData = {
        ...prev,
        summary: {
          ...prev.summary,
          totalBalance: prev.summary.totalBalance + balanceDelta,
          availableToSpend: prev.summary.availableToSpend + balanceDelta,
        },
        wallets: updatedWallets,
        transactions: [optimisticTx, ...prev.transactions],
      };

      try {
        sessionStorage.setItem('pocketq_dashboard_cache', JSON.stringify(nextData));
      } catch {}

      return nextData;
    });

    // 2. Close modal immediately without waiting on network round-trip
    setTxAmount('');
    setTxNote('');
    setActiveModal(null);

    // 3. Persist to backend and silently reconcile server state
    try {
      await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TRANSACTION',
          type: capturedType,
          amount: numericAmount,
          category: capturedCategory,
          note: capturedNote,
          walletId: capturedWalletId,
          targetWalletId: capturedTargetWalletId,
        }),
      });
      fetchDashboard();
    } catch (err) {
      console.error(err);
      fetchDashboard();
    }
  };

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
        category: obCategory,
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
    fetchDashboard();
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
    fetchDashboard();
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
    fetchDashboard();
  };

  const handleDeleteObligation = async (obligationId: string) => {
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE_OBLIGATION', obligationId }),
    });
    fetchDashboard();
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
    fetchDashboard();
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
    fetchDashboard();
  };

  const handleDeleteSavings = async (savingsGoalId: string) => {
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE_SAVINGS', savingsGoalId }),
    });
    fetchDashboard();
  };

  const handleSplitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const preview = computeSplitPreview();
    if (!splitTitle || preview.grandTotal <= 0) return;
    setSubmitting(true);
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'BILL_SPLIT',
        title: splitTitle,
        splitMode,
        vatAmount: preview.vatAmount,
        paidByMe,
        walletId: splitWalletId,
        participants: preview.breakdown.map((b) => ({
          name: b.name,
          isMe: b.isMe,
          itemTotal: b.itemTotal,
        })),
      }),
    });
    setSplitTitle('');
    setEqualTotalBill('');
    setSplitVatInput('');
    setSplitPeople([
      { name: 'Me', isMe: true, itemTotal: '', cashGiven: '' },
      { name: 'Friend 1', isMe: false, itemTotal: '', cashGiven: '' },
    ]);
    setSubmitting(false);
    setActiveModal(null);
    fetchDashboard();
  };

  const handleSettleFriend = async (participantId: string) => {
    if (!data?.wallets?.length) return;
    await fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SETTLE_SPLIT',
        participantId,
        walletId: settleWalletId || data.wallets[0].id,
      }),
    });
    fetchDashboard();
  };

  const openNewWalletModal = () => {
    setEditingWallet(null);
    setWalletName("");
    setWalletType("MFS");
    setWalletBalance("");
    setWalletModalOpen(true);
  };

  const openEditWalletModal = (w: WalletItem) => {
    setEditingWallet(w);
    setWalletName(w.name);
    setWalletType(w.type);
    setWalletBalance(String(w.balance));
    setWalletModalOpen(true);
  };

  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletName.trim()) return;
    setSubmitting(true);
    try {
      const method = editingWallet ? "PATCH" : "POST";
      const payload = editingWallet
        ? { id: editingWallet.id, name: walletName, type: walletType, balance: Number(walletBalance) || 0 }
        : { name: walletName, type: walletType, balance: Number(walletBalance) || 0 };

      const res = await fetch("/api/wallets", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setWalletModalOpen(false);
        setEditingWallet(null);
        await fetchDashboard();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWallet = async (w: WalletItem) => {
    const res = await fetch(`/api/wallets?id=${w.id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    if (res.ok) {
      await fetchDashboard();
    }
  };

  const formatDateDDMMYYYY = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const preview = computeSplitPreview();

  // Analytics & Cashflow Computations
  const categoryColors = ["#D52073", "#FFEF5C", "#B3EFB2", "#7A9E7E", "#E8F1F2", "#31493C"];
  const expenseTxs = data.transactions.filter((t) => t.type === "EXPENSE");
  const incomeTxs = data.transactions.filter((t) => t.type === "INCOME");

  const totalSpent = expenseTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomeTxs.reduce((sum, t) => sum + t.amount, 0);
  const netCashflow = totalIncome - totalSpent;

  const categoryMap: Record<string, number> = {};
  expenseTxs.forEach((t) => {
    const cat = t.category || "Other";
    categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;
  });

  const categoryBreakdown = Object.entries(categoryMap)
    .map(([name, amount], idx) => ({
      name,
      amount,
      percent: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      color: categoryColors[idx % categoryColors.length],
    }))
    .sort((a, b) => b.amount - a.amount);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;
  const donutSegments = categoryBreakdown.map((item) => {
    const strokeDasharray = `${(item.percent / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((cumulativePercent / 100) * circumference);
    cumulativePercent += item.percent;
    return { ...item, strokeDasharray, strokeDashoffset };
  });

  const activeCategoryObj =
    categoryBreakdown.find((c) => c.name === hoveredCategory) || categoryBreakdown[0] || null;

  const maxCashflowVal = Math.max(totalIncome, totalSpent, 1);

  const navContainerRef = React.useRef<HTMLDivElement | null>(null);
  const navItemRefs = React.useRef<Record<string, HTMLButtonElement | HTMLAnchorElement | null>>({});
  const [activeNavTab, setActiveNavTab] = useState<string>('overview');
  const [underlineStyle, setUnderlineStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    const updateUnderline = () => {
      const container = navContainerRef.current;
      const activeEl = navItemRefs.current[activeNavTab];
      if (container && activeEl) {
        const containerRect = container.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        setUnderlineStyle({
          left: activeRect.left - containerRect.left,
          width: activeRect.width,
        });
      }
    };
    updateUnderline();
    window.addEventListener('resize', updateUnderline);
    return () => window.removeEventListener('resize', updateUnderline);
  }, [activeNavTab]);

  return (
    <div
      className={`min-h-screen overflow-x-hidden transition-colors duration-200 ${
        darkMode ? 'bg-black text-[#E8F1F2]' : 'bg-[#E8F1F2] text-[#001A23]'
      }`}
    >
      <AppHeader
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onAddEntry={() => setActiveModal('TRANSACTION')}
      />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Hero + Wallets Responsive Section (Mobile: Safe Spend -> Slider -> Wallets -> Obligations -> Savings | Desktop: 3-Col Hero + Wallets Row) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* LEFT COLUMN on Desktop (3 cols), 4th on Mobile: Reserved Obligations */}
          <div
            className={`order-3 lg:order-1 lg:col-span-3 rounded-3xl p-4 border flex flex-col justify-between ${
              darkMode
                ? 'bg-[#31493C]/30 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-sm'
            }`}
          >
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <h2 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-[#D52073] shrink-0" />
                  Obligations
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveModal('OBLIGATION')}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg bg-[#FFEF5C] text-[#001A23] hover:brightness-95 cursor-pointer shrink-0"
                >
                  + Add
                </button>
              </div>

              {(() => {
                const totalReq = data.obligations.reduce((s, o) => s + o.totalAmount, 0);
                const totalRes = data.obligations.reduce((s, o) => s + (o.isPaid ? 0 : o.reservedAmount), 0);
                const totalPaid = data.obligations.reduce((s, o) => s + o.paidAmount, 0);
                const totalOut = Math.max(0, totalReq - totalPaid);
                return (
                  <div className="grid grid-cols-2 gap-1 text-[10px] p-2 rounded-xl bg-black/5 dark:bg-white/5 mb-2.5">
                    <span>Reserved: <strong className="text-[#7A9E7E]">{formatBDT(totalRes)}</strong></span>
                    <span>Due: <strong className="text-[#D52073]">{formatBDT(totalOut)}</strong></span>
                  </div>
                );
              })()}

              {/* Shows up to 2 upcoming obligations completely before the See More + link */}
              <div className="space-y-2.5">
                {data.obligations.length === 0 ? (
                  <p className="text-xs opacity-60 py-6 text-center">No obligations added yet.</p>
                ) : (
                  /* Render up to 3 upcoming obligations to naturally fill the hero column height */
                  data.obligations.slice(0, 3).map((ob) => {
                    const remainingToPay = Math.max(0, ob.totalAmount - ob.paidAmount);
                    const isOverdue = !ob.isPaid && nowMs > 0 && new Date(ob.dueDate).getTime() < nowMs;
                    const statusLabel = ob.isPaid
                      ? "Paid"
                      : isOverdue
                      ? "Overdue"
                      : ob.reservedAmount >= remainingToPay && remainingToPay > 0
                      ? "Fully Reserved"
                      : ob.reservedAmount > 0
                      ? "Partially Reserved"
                      : "Not Reserved";

                    return (
                      <div
                        key={ob.id}
                        className={`p-2.5 rounded-2xl border space-y-1.5 ${
                          darkMode
                            ? 'bg-black/60 border-[#31493C]'
                            : 'bg-[#E8F1F2]/60 border-[#7A9E7E]/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-xs font-bold line-clamp-1">{ob.title}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                              ob.isPaid
                                ? "bg-[#B3EFB2] text-[#001A23]"
                                : isOverdue
                                ? "bg-[#D52073] text-white"
                                : ob.reservedAmount >= remainingToPay
                                ? "bg-[#7A9E7E] text-white"
                                : "bg-[#FFEF5C] text-[#001A23]"
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </div>

                        <div className="text-[10px] opacity-80 space-y-0.5">
                          <div className="flex justify-between">
                            <span>Reserved: <strong>{formatBDT(ob.reservedAmount)}</strong></span>
                            <span>Left: <strong className="text-[#D52073]">{formatBDT(remainingToPay)}</strong></span>
                          </div>
                          <div>Due {formatDateDDMMYYYY(ob.dueDate)}</div>
                        </div>

                        {!ob.isPaid && (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOb(ob);
                                setReserveMode('ADD');
                                setReserveAmtInput('');
                                setActiveModal('RESERVE_OB');
                              }}
                              className="flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold border border-[#31493C] dark:border-[#B3EFB2]/50 hover:bg-[#7A9E7E]/15 cursor-pointer"
                            >
                              + Reserve
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
                              className="flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold bg-[#31493C] text-[#B3EFB2] hover:opacity-90 cursor-pointer"
                            >
                              Pay
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer link to full Reserved Funds & Deadline Funding Planner */}
            <Link
              href="/reserved"
              className="mt-3 py-2.5 px-4 w-full rounded-xl border border-[#7A9E7E]/25 flex items-center justify-center gap-1.5 text-xs font-bold text-center leading-none hover:brightness-110 transition"
            >
              See More + {data.obligations.length > 3 ? `(${data.obligations.length} total)` : ""}
            </Link>
          </div>

          {/* CENTER COLUMN on Desktop (6 cols), 1st & 2nd on Mobile: Safe Spendable Cash + Can I Afford It? */}
          <div className="order-1 lg:order-2 lg:col-span-6 flex flex-col gap-4">
          <div className="rounded-3xl hero-spendable-card p-5 text-[#F2F8FA] shadow-md relative overflow-hidden">
            <div className="flex flex-col items-start gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-[#B3EFB2]/20 text-[#B3EFB2]">
                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                Safe Spendable Cash
              </span>
              <span className="text-xs opacity-75 pl-0.5">
                After upcoming obligations
              </span>
            </div>

            <div className="mt-4">
              <div className="hero-spendable-amount text-4xl sm:text-5xl font-extrabold text-[#3EE895] tracking-tight" style={darkMode ? undefined : { color: "#000000" }}>
                {formatBDT(data.summary.availableToSpend)}
              </div>
              <p className="text-sm mt-2 text-[#E8F1F2]/85">
                You hold <strong>{formatBDT(data.summary.totalBalance)}</strong> across wallets,
                with <strong>{formatBDT(data.summary.totalReserved)}</strong> reserved for upcoming commitments.
              </p>
            </div>

            <div className="mt-4 pt-3.5 border-t border-[#7A9E7E]/30 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="opacity-70 block">Total Owned</span>
                <span className="font-bold text-base">{formatBDT(data.summary.totalBalance)}</span>
              </div>
              <div>
                <span className="opacity-70 block">Obligations Reserved</span>
                <span className="font-bold text-base text-[#F4FAFB]">
                  -{formatBDT(data.summary.totalReservedObligations ?? 0)}
                </span>
              </div>
              <div>
                <span className="opacity-70 block">Savings Reserved</span>
                <span className="font-bold text-base text-[#F4FAFB]">
                  -{formatBDT(data.summary.totalReservedSavings ?? 0)}
                </span>
              </div>
              <div>
                <span className="opacity-70 block">Owed by Friends</span>
                <span className="font-bold text-base text-[#F4FAFB]">
                  +{formatBDT(data.summary.owedByFriends)}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Impulse Simulator & Daily Runway */}
          <div
            className={`rounded-3xl p-5 border transition-all ${
              darkMode
                ? "bg-[#31493C]/20 border-[#31493C]"
                : "bg-white border-[#7A9E7E]/25 shadow-sm"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#7A9E7E] block">
                  Can I Afford It?
                </span>
                <p className="text-xs opacity-75">
                  Safe &ge; {formatBDT(dailySafeThreshold)}/day &middot; Crazy &le; {formatBDT(dailyCrazyThreshold)}/day
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraftSafeLimit(String(dailySafeThreshold));
                    setDraftCrazyLimit(String(dailyCrazyThreshold));
                    setEditingSimLimits((v) => !v);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                    editingSimLimits
                      ? "bg-[#31493C] text-[#B3EFB2] border-[#31493C]"
                      : "border-[#7A9E7E]/35 hover:bg-[#7A9E7E]/15"
                  }`}
                >
                  {editingSimLimits ? "Close Limits" : "Set Limits"}
                </button>
                <div className="flex items-center gap-1 p-1 rounded-full bg-[#7A9E7E]/15 text-xs font-semibold">
                  {[7, 15, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setRunwayDays(d)}
                      className={`px-2.5 py-1 rounded-full transition cursor-pointer ${
                        runwayDays === d
                          ? "bg-[#31493C] text-[#B3EFB2] shadow-xs"
                          : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {editingSimLimits && (
              <div
                className={`mb-3 p-3 rounded-2xl border text-xs space-y-2.5 ${
                  darkMode
                    ? "bg-black/40 border-[#31493C]"
                    : "bg-[#E8F1F2]/70 border-[#7A9E7E]/25"
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-semibold block mb-1">
                      &ldquo;You Can&rdquo; Daily Limit (&ge;/day)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={draftSafeLimit}
                      onChange={(e) => setDraftSafeLimit(e.target.value)}
                      className="w-full rounded-xl px-3 py-1.5 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">
                      &ldquo;This Is Crazy&rdquo; Daily Limit (&le;/day)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={draftCrazyLimit}
                      onChange={(e) => setDraftCrazyLimit(e.target.value)}
                      className="w-full rounded-xl px-3 py-1.5 text-xs border border-[#7A9E7E]/30 bg-transparent outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] opacity-70">
                    Between {formatBDT(Number(draftCrazyLimit) || 0)} and {formatBDT(Number(draftSafeLimit) || 0)}/day shows &ldquo;You Shouldn&apos;t&rdquo;.
                  </span>
                  <button
                    type="button"
                    disabled={savingSimLimits}
                    onClick={async () => {
                      const nextSafe = Math.max(0, Number(draftSafeLimit) || 0);
                      const nextCrazy = Math.max(0, Math.min(nextSafe, Number(draftCrazyLimit) || 0));
                      setSavingSimLimits(true);
                      try {
                        const res = await fetch('/api/dashboard', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'UPDATE_SIMULATOR_LIMITS',
                            dailySafeThreshold: nextSafe,
                            dailyCrazyThreshold: nextCrazy,
                          }),
                        });
                        if (res.ok) {
                          setDailySafeThreshold(nextSafe);
                          setDailyCrazyThreshold(nextCrazy);
                          setDraftSafeLimit(String(nextSafe));
                          setDraftCrazyLimit(String(nextCrazy));
                          setEditingSimLimits(false);
                        }
                      } finally {
                        setSavingSimLimits(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#31493C] text-[#B3EFB2] font-bold hover:brightness-110 transition cursor-pointer shrink-0"
                  >
                    {savingSimLimits ? "Saving..." : "Save Limits"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mb-3">
              {(() => {
                const sliderMax = Math.max(15000, Math.round(data.summary.availableToSpend));
                const sliderVal = Math.min(Math.max(0, simAmount), sliderMax);
                const pct = sliderMax > 0 ? (sliderVal / sliderMax) * 100 : 0;

                const updateFromClientX = (el: HTMLDivElement, clientX: number) => {
                  const rect = el.getBoundingClientRect();
                  if (rect.width <= 0) return;
                  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
                  setSimAmount(Math.round(ratio * sliderMax));
                };

                return (
                  <div
                    role="slider"
                    tabIndex={0}
                    aria-valuemin={0}
                    aria-valuemax={sliderMax}
                    aria-valuenow={sliderVal}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      updateFromClientX(e.currentTarget, e.clientX);
                    }}
                    onPointerMove={(e) => {
                      if (e.buttons === 1 || e.pressure > 0) {
                        updateFromClientX(e.currentTarget, e.clientX);
                      }
                    }}
                    onKeyDown={(e) => {
                      const delta = Math.max(1, Math.round(sliderMax / 100));
                      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSimAmount(Math.min(sliderMax, sliderVal + delta));
                      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSimAmount(Math.max(0, sliderVal - delta));
                      }
                    }}
                    className="relative w-full h-9 flex items-center select-none touch-none cursor-pointer group outline-none"
                  >
                    {/* Pill-Round Translucent Liquid Glass Track */}
                    <div
                      className="liquid-glass-slider-track w-full h-3 overflow-hidden backdrop-blur-md"
                      style={{
                        background: darkMode
                          ? 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)'
                          : 'linear-gradient(180deg, rgba(0,26,35,0.15) 0%, rgba(0,26,35,0.07) 100%)',
                        border: darkMode
                          ? '1px solid rgba(255,255,255,0.18)'
                          : '1px solid rgba(0,26,35,0.15)',
                        boxShadow: darkMode
                          ? 'inset 0 1px 2px rgba(0,0,0,0.6)'
                          : 'inset 0 1px 2px rgba(0,26,35,0.12)',
                      }}
                    >
                      {/* Pill-Round Luminous Liquid Fill */}
                      <div
                        className="liquid-glass-slider-fill h-full"
                        style={{
                          width: `${pct}%`,
                          background: darkMode
                            ? 'linear-gradient(90deg, rgba(179,239,178,0.34) 0%, rgba(62,232,149,0.62) 100%)'
                            : 'linear-gradient(90deg, rgba(13,110,72,0.38) 0%, rgba(16,145,92,0.62) 100%)',
                        }}
                      />
                    </div>

                    {/* Circular Frosted Liquid Glass Thumb */}
                    <div
                      className="liquid-glass-slider-thumb pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 backdrop-blur-xl transition-transform duration-150 group-hover:scale-110 group-active:scale-125"
                      style={{
                        left: `${pct}%`,
                        background: darkMode
                          ? 'linear-gradient(180deg, rgba(255,255,255,0.48) 0%, rgba(179,239,178,0.26) 100%)'
                          : 'linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(16,120,80,0.36) 100%)',
                        borderLeft: darkMode
                          ? '1px solid rgba(255,255,255,0.62)'
                          : '1px solid rgba(11,94,62,0.45)',
                        borderRight: darkMode
                          ? '1px solid rgba(255,255,255,0.62)'
                          : '1px solid rgba(11,94,62,0.45)',
                        borderBottom: darkMode
                          ? '1px solid rgba(255,255,255,0.62)'
                          : '1px solid rgba(11,94,62,0.45)',
                        borderTop: '1.5px solid rgba(255,255,255,0.96)',
                        boxShadow: darkMode
                          ? '0 4px 14px rgba(0,0,0,0.48), inset 0 1px 1px rgba(255,255,255,0.75)'
                          : '0 4px 14px rgba(0,26,35,0.22), inset 0 1px 1px rgba(255,255,255,0.92)',
                      }}
                    />
                  </div>
                );
              })()}
              <div className="relative flex items-center shrink-0">
                <span className="pointer-events-none absolute left-3 text-xs font-extrabold text-[#D52073]">
                  -৳
                </span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  aria-label="Purchase amount to simulate"
                  value={simAmount === 0 ? "" : simAmount}
                  placeholder="0"
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setSimAmount(0);
                      return;
                    }
                    const parsed = Number(raw);
                    if (!Number.isNaN(parsed) && parsed >= 0) {
                      setSimAmount(parsed);
                    }
                  }}
                  className="w-28 sm:w-32 pl-8 pr-2.5 py-1.5 rounded-xl text-right font-extrabold text-sm text-[#D52073] outline-none transition focus:ring-2 focus:ring-[#D52073]/40"
                />
              </div>
            </div>

            {(() => {
              const postSpend = data.summary.availableToSpend - simAmount;
              const rawDaily = postSpend / runwayDays;
              const dailySafe = Math.max(0, Math.round(rawDaily));
              const isDanger = postSpend < 0 || rawDaily <= dailyCrazyThreshold;
              const isTight = !isDanger && rawDaily < dailySafeThreshold;

              return (
                <div className="pt-3 border-t border-[#7A9E7E]/20 flex flex-nowrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div>
                      <span className="opacity-70 block">Left After Spend</span>
                      <span
                        className={`font-extrabold text-sm ${
                          isDanger
                            ? "text-[#D52073]"
                            : isTight
                            ? "text-[#FFEF5C]"
                            : "sim-left-after-spend-safe"
                        }`}
                      >
                        {formatBDT(postSpend)}
                      </span>
                    </div>
                    <div className="h-6 w-px bg-[#7A9E7E]/25" />
                    <div>
                      <span className="opacity-70 block">{runwayDays}-Day Daily Limit</span>
                      <span
                        style={{ color: "#D52073" }}
                        className="font-bold text-sm text-[#D52073]"
                      >
                        {formatBDT(dailySafe)}/day
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full font-bold text-[11px] whitespace-nowrap shrink-0 ${
                      isDanger
                        ? "bg-[#D52073] text-white"
                        : isTight
                        ? "bg-[#FFEF5C] text-[#001A23]"
                        : "bg-[#B3EFB2] text-[#001A23]"
                    }`}
                  >
                    {isDanger
                      ? "This Is Crazy"
                      : isTight
                      ? `You Shouldn't`
                      : "You Can"}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

          {/* RIGHT COLUMN on Desktop (3 cols), 5th on Mobile: Savings & Emergency Funds */}
          <div
            className={`order-4 lg:order-3 lg:col-span-3 rounded-3xl p-4 border flex flex-col justify-between ${
              darkMode
                ? 'bg-[#31493C]/30 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-sm'
            }`}
          >
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <h2 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Vault className="w-4 h-4 text-[#7A9E7E] shrink-0" />
                  Savings
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveModal('CREATE_SAVINGS')}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg bg-[#B3EFB2] text-[#001A23] hover:brightness-95 cursor-pointer shrink-0"
                >
                  + New
                </button>
              </div>

              <div className="text-[10px] p-2 rounded-xl bg-black/5 dark:bg-white/5 mb-2.5 flex justify-between">
                <span>Total Saved:</span>
                <strong className="text-[#7A9E7E]">
                  {formatBDT((data.savingsGoals || []).reduce((s, g) => s + g.currentBalance, 0))}
                </strong>
              </div>

              {/* Render up to 4 savings goals so the right card matches the center stack height cleanly */}
              <div className="space-y-2.5">
                {!data.savingsGoals || data.savingsGoals.length === 0 ? (
                  <p className="text-xs opacity-60 py-6 text-center">No savings entries yet.</p>
                ) : (
                  data.savingsGoals.slice(0, 4).map((goal) => (
                    <div
                      key={goal.id}
                      className={`p-2.5 rounded-2xl border space-y-1.5 ${
                        darkMode
                          ? 'bg-black/60 border-[#31493C]'
                          : 'bg-[#E8F1F2]/60 border-[#7A9E7E]/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-xs line-clamp-1">{goal.name}</span>
                        <span className="font-extrabold text-xs text-[#7A9E7E] shrink-0">
                          {formatBDT(goal.currentBalance)}
                        </span>
                      </div>
                      {(goal.targetAmount || goal.targetDate) && (
                        <div className="text-[10px] opacity-70 truncate">
                          {goal.targetAmount ? `Target: ${formatBDT(goal.targetAmount)}` : ""}
                          {goal.targetAmount && goal.targetDate ? " • " : ""}
                          {goal.targetDate ? formatDateDDMMYYYY(goal.targetDate) : ""}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 pt-0.5">
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
                          className="flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold bg-[#B3EFB2] text-[#001A23] cursor-pointer"
                        >
                          + Add
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
                          className="flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold border border-[#31493C] dark:border-[#B3EFB2]/40 cursor-pointer"
                        >
                          Use / Move
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Link
              href="/reserved"
              className="mt-3 py-2.5 px-4 w-full rounded-xl border border-[#7A9E7E]/25 flex items-center justify-center gap-1.5 text-xs font-bold text-center leading-none hover:brightness-110 transition"
            >
              See More + {data.savingsGoals && data.savingsGoals.length > 4 ? `(${data.savingsGoals.length} total)` : ""}
            </Link>
          </div>

          {/* Wallets Row: 3rd on Mobile (right after Slider), Full-Width Row below Hero on Desktop */}
          <div className="order-2 lg:order-4 lg:col-span-12 pt-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#7A9E7E]" />
              My Wallets
            </h2>
            <button
              type="button"
              onClick={openNewWalletModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#B3EFB2] text-[#001A23] hover:opacity-90 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Wallet
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {data.wallets.map((w) => (
              <div
                key={w.id}
                className={`group rounded-2xl p-4 border transition ${
                  darkMode
                    ? 'bg-[#31493C]/25 border-[#31493C] hover:border-[#B3EFB2]/50'
                    : 'bg-white border-[#7A9E7E]/25 shadow-sm hover:border-[#31493C]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
                    {w.type}
                  </span>
                  <div className="flex items-center gap-1 opacity-75 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      onClick={() => openEditWalletModal(w)}
                      title="Edit wallet"
                      className="p-1 rounded-lg hover:bg-[#7A9E7E]/20 transition cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {data.wallets.length > 1 && (
                      confirmDeleteId === w.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteWallet(w)}
                            className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#D52073] text-white cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 rounded-full text-[11px] opacity-70 hover:opacity-100 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(w.id)}
                          title="Delete wallet"
                          className="p-1 rounded-lg hover:bg-[#D52073]/20 text-[#D52073] transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
                <div className="font-bold text-base mt-1">{w.name}</div>
                <div className="text-2xl font-extrabold mt-2">{formatBDT(w.balance)}</div>
              </div>
            ))}
          </div>
                  </div>
        </section>

        {/* Spending Analytics & Cashflow Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spending by Category Donut */}
          <div
            className={`rounded-3xl p-5 border ${
              darkMode
                ? "bg-[#31493C]/25 border-[#31493C]"
                : "bg-white border-[#7A9E7E]/25 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#D52073]" />
                Spending by Category
              </h2>
              <span className="text-xs font-semibold opacity-70">
                Total: {formatBDT(totalSpent)}
              </span>
            </div>

            {categoryBreakdown.length === 0 ? (
              <div className="py-10 text-center text-xs opacity-60">
                No expenses recorded yet. Log an expense to see your category breakdown.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Interactive SVG Donut */}
                <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg className="w-36 h-36 -rotate-90 liquid-glass-pie" viewBox="0 0 140 140">
                    <defs>
                      <linearGradient id="liquidGlassSheen" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.65)" />
                        <stop offset="45%" stopColor="rgba(255,255,255,0.08)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0.28)" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="70"
                      cy="70"
                      r={radius}
                      fill="transparent"
                      stroke={darkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)"}
                      strokeWidth="16"
                    />
                    {donutSegments.map((seg) => {
                      const isDimmed = hoveredCategory && hoveredCategory !== seg.name;
                      return (
                        <circle
                          key={seg.name}
                          cx="70"
                          cy="70"
                          r={radius}
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth={hoveredCategory === seg.name ? "19" : "16"}
                          strokeDasharray={seg.strokeDasharray}
                          strokeDashoffset={seg.strokeDashoffset}
                          strokeLinecap="butt"
                          onMouseEnter={() => setHoveredCategory(seg.name)}
                          onMouseLeave={() => setHoveredCategory(null)}
                          className="pie-segment transition-all duration-200 cursor-pointer"
                          style={{ opacity: isDimmed ? 0.32 : 0.85 }}
                        />
                      );
                    })}
                    {/* Specular Liquid Glass Rim & Highlight Overlay */}
                    <circle
                      cx="70"
                      cy="70"
                      r={radius}
                      fill="transparent"
                      stroke="url(#liquidGlassSheen)"
                      strokeWidth="16"
                      className="pointer-events-none"
                    />
                    <circle
                      cx="70"
                      cy="70"
                      r={radius + 7.5}
                      fill="transparent"
                      stroke="rgba(255,255,255,0.38)"
                      strokeWidth="1"
                      className="pointer-events-none"
                    />
                    <circle
                      cx="70"
                      cy="70"
                      r={radius - 7.5}
                      fill="transparent"
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth="1"
                      className="pointer-events-none"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 pointer-events-none">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 truncate max-w-[85px]">
                      {activeCategoryObj?.name}
                    </span>
                    <span className="text-sm font-extrabold mt-0.5">
                      {activeCategoryObj ? `${activeCategoryObj.percent.toFixed(0)}%` : "0%"}
                    </span>
                  </div>
                </div>

                {/* Category Legend & Bars */}
                <div className="w-full space-y-2.5">
                  {categoryBreakdown.map((cat) => (
                    <div
                      key={cat.name}
                      onMouseEnter={() => setHoveredCategory(cat.name)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className={`p-2 rounded-xl transition cursor-pointer ${
                        hoveredCategory === cat.name
                          ? darkMode
                            ? "bg-black/60"
                            : "bg-[#E8F1F2]/80"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </span>
                        <span>
                          {formatBDT(cat.amount)}{" "}
                          <span className="opacity-60 font-normal">
                            ({cat.percent.toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <div
                        className={`w-full h-1.5 rounded-full overflow-hidden ${
                          darkMode ? "bg-black/60" : "bg-[#E8F1F2]"
                        }`}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${cat.percent}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cashflow & Wallet Distribution */}
          <div
            className={`rounded-3xl p-5 border flex flex-col justify-between ${
              darkMode
                ? "bg-[#31493C]/25 border-[#31493C]"
                : "bg-white border-[#7A9E7E]/25 shadow-sm"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#B3EFB2]" />
                  Cashflow & Wallet Share
                </h2>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    netCashflow >= 0
                      ? "bg-[#B3EFB2] text-[#001A23]"
                      : "bg-[#D52073] text-white"
                  }`}
                >
                  Net: {netCashflow >= 0 ? "+" : ""}
                  {formatBDT(netCashflow)}
                </span>
              </div>

              {/* Income vs Expense Comparison Bars */}
              <div className="space-y-3 mb-5">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="opacity-80">Total Inflow (Income)</span>
                    <span className="font-bold text-[#31493C] dark:text-[#B3EFB2]">
                      {formatBDT(totalIncome)}
                    </span>
                  </div>
                  <div
                    className={`w-full h-3 rounded-full overflow-hidden ${
                      darkMode ? "bg-black/60" : "bg-[#E8F1F2]"
                    }`}
                  >
                    <div
                      className="h-full rounded-full bg-[#B3EFB2] transition-all duration-300"
                      style={{ width: `${(totalIncome / maxCashflowVal) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="opacity-80">Total Outflow (Expenses)</span>
                    <span className="font-bold text-[#D52073]">{formatBDT(totalSpent)}</span>
                  </div>
                  <div
                    className={`w-full h-3 rounded-full overflow-hidden ${
                      darkMode ? "bg-black/60" : "bg-[#E8F1F2]"
                    }`}
                  >
                    <div
                      className="h-full rounded-full bg-[#D52073] transition-all duration-300"
                      style={{ width: `${(totalSpent / maxCashflowVal) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Proportional Wallet Balance Bar */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-2 opacity-75">
                <span>Liquidity Distribution Across Wallets</span>
                <span>{data.wallets.length} active</span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden flex gap-0.5">
                {data.wallets.map((w, idx) => {
                  const share =
                    data.summary.totalBalance > 0
                      ? Math.max((w.balance / data.summary.totalBalance) * 100, 0)
                      : 0;
                  const barColors = ["#B3EFB2", "#FFEF5C", "#7A9E7E", "#D52073", "#E8F1F2"];
                  return (
                    <div
                      key={w.id}
                      title={`${w.name}: ${formatBDT(w.balance)} (${share.toFixed(0)}%)`}
                      style={{
                        width: `${share}%`,
                        backgroundColor: barColors[idx % barColors.length],
                      }}
                      className="h-full transition-all duration-300"
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                {data.wallets.map((w, idx) => {
                  const share =
                    data.summary.totalBalance > 0
                      ? Math.max((w.balance / data.summary.totalBalance) * 100, 0)
                      : 0;
                  const barColors = ["#B3EFB2", "#FFEF5C", "#7A9E7E", "#D52073", "#E8F1F2"];

  return (
                    <span key={w.id} className="text-[11px] flex items-center gap-1.5 opacity-85">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: barColors[idx % barColors.length] }}
                      />
                      {w.name} ({share.toFixed(0)}%)
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Split Bills & Recent Activity Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Group & Restaurant Splits */}
          <div
            className={`rounded-3xl p-5 border ${
              darkMode
                ? 'bg-[#31493C]/25 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-sm'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#D52073]" />
                Group & Restaurant Splits
              </h2>
              <div className="flex items-center gap-2">

                <button
                  onClick={() => { window.location.href = '/split'; }}
                  className="text-xs font-semibold text-[#31493C] dark:text-[#B3EFB2] underline cursor-pointer"
                >
                  + New Split
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {data.billSplits.map((split) => (
                <div
                  key={split.id}
                  className={`p-4 rounded-2xl border ${
                    darkMode
                      ? 'bg-black/60 border-[#31493C]'
                      : 'bg-[#E8F1F2]/60 border-[#7A9E7E]/20'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm">{split.title}</h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            split.paidByMe
                              ? "bg-[#B3EFB2] text-[#001A23]"
                              : "bg-[#D52073] text-white"
                          }`}
                        >
                          {split.paidByMe ? "Friends Owe You" : "You Owe Share"}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-70">
                        {split.splitMode === 'ITEMIZED' ? 'Itemized + Proportional VAT' : 'Equal Split'} • Total{' '}
                        {formatBDT(split.totalAmount)} (VAT {formatBDT(split.vatAmount)})
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {split.participants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-black/5 dark:bg-white/5"
                      >
                        <div>
                          <span className="font-semibold">{p.name}</span>
                          <span className="opacity-70 ml-2">
                            (Food {formatBDT(p.itemTotal)} + VAT {formatBDT(p.vatShare)})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{formatBDT(p.finalOwed)}</span>
                          {p.isSettled ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#7A9E7E] font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSettleFriend(p.id)}
                              className="px-2 py-0.5 rounded-lg bg-[#B3EFB2] text-[#001A23] font-semibold text-[11px] hover:brightness-95 cursor-pointer"
                            >
                              Settle
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Transactions */}
          <div
            className={`rounded-3xl p-5 border ${
              darkMode
                ? 'bg-[#31493C]/25 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-sm'
            }`}
          >
            <h2 className="font-bold text-base mb-4">Recent Activity</h2>
            <div className="space-y-2.5">
              {data.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border ${
                    darkMode
                      ? 'bg-black/50 border-[#31493C]/60'
                      : 'bg-[#E8F1F2]/50 border-[#7A9E7E]/15'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        tx.type === 'INCOME'
                          ? 'bg-[#B3EFB2] text-[#001A23]'
                          : tx.type === 'EXPENSE'
                          ? 'bg-[#D52073]/15 text-[#D52073]'
                          : 'bg-[#FFEF5C]/40 text-[#001A23]'
                      }`}
                    >
                      {tx.type === 'INCOME' ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : tx.type === 'EXPENSE' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowLeftRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{tx.category}</div>
                      <div className="text-xs opacity-70">
                        {tx.wallet.name}
                        {tx.targetWallet ? ` → ${tx.targetWallet.name}` : ''}
                        {tx.note ? ` • ${tx.note}` : ''}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`font-bold text-sm ${
                      tx.type === 'INCOME'
                        ? 'text-[#7A9E7E]'
                        : tx.type === 'EXPENSE'
                        ? 'text-[#D52073]'
                        : ''
                    }`}
                  >
                    {tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '-' : ''}
                    {formatBDT(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* MODAL 1: Add Income / Expense / Transfer */}
      {activeModal === 'TRANSACTION' && (
        <div className="fixed inset-0 z-50 bg-[#001A23]/25 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-xl border ${
              darkMode
                ? 'bg-[#0E181C]/75 backdrop-blur-2xl border-[#E8F1F2]/15 text-[#E8F1F2]'
                : 'bg-white/60 backdrop-blur-2xl border-white/80 text-[#001A23]'
            }`}
          >
            <h3 className="font-bold text-lg mb-4">Record Entry</h3>
            <form onSubmit={handleTransactionSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setTxType(t)}
                    className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      txType === t
                        ? 'bg-[#31493C] text-[#B3EFB2]'
                        : 'bg-[#E8F1F2] text-[#001A23]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Amount (৳)</label>
                <input
                  type="number"
                  required
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">
                  {txType === 'TRANSFER' ? 'From Wallet' : 'Wallet'}
                </label>
                <select
                  value={txWalletId}
                  onChange={(e) => setTxWalletId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                >
                  {data.wallets.map((w) => (
                    <option key={w.id} value={w.id} className="text-[#001A23]">
                      {w.name} ({formatBDT(w.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {txType === 'TRANSFER' ? (
                <div>
                  <label className="text-xs font-semibold block mb-1">To Wallet</label>
                  <select
                    value={txTargetWalletId}
                    onChange={(e) => setTxTargetWalletId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                  >
                    {data.wallets.map((w) => (
                      <option key={w.id} value={w.id} className="text-[#001A23]">
                        {w.name} ({formatBDT(w.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold block mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    placeholder={txType === "INCOME" ? "e.g. Salary, Freelance, Allowance" : "e.g. Food, Transport, Groceries"}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold block mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  placeholder="Short description..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
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
                  {submitting ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2A: Create Reserved Obligation (with optional installments) */}
      {activeModal === 'OBLIGATION' && (
        <div className="fixed inset-0 z-50 bg-[#001A23]/25 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`w-full max-w-lg rounded-3xl p-6 shadow-xl border my-8 ${
              darkMode
                ? 'bg-[#0E181C]/75 backdrop-blur-2xl border-[#E8F1F2]/15 text-[#E8F1F2]'
                : 'bg-white/60 backdrop-blur-2xl border-white/80 text-[#001A23]'
            }`}
          >
            <h3 className="font-bold text-lg mb-1">New Reserved Obligation</h3>
            <p className="text-xs opacity-70 mb-4">
              Track money required for upcoming fees, rent, installments, or bills. Reserving money does not count as an expense until you confirm payment.
            </p>
            <form onSubmit={handleObligationSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold block mb-1">Obligation Name</label>
                <input
                  type="text"
                  required
                  value={obTitle}
                  onChange={(e) => setObTitle(e.target.value)}
                  placeholder="e.g. University Trimester Fee, House Rent"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
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
                    placeholder="e.g. 30000"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Currently Reserved (৳)</label>
                  <input
                    type="number"
                    value={obInitialReserved}
                    onChange={(e) => setObInitialReserved(e.target.value)}
                    placeholder="e.g. 10000"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Payment Deadline</label>
                  <DDMMYYYYInput
                    required
                    value={obDueDate}
                    onChange={setObDueDate}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={obNotes}
                    onChange={setObNotes}
                    placeholder="e.g. Pay via bKash / Bank"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                  />
                </div>
              </div>

              {/* Optional Installment Schedule */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold">Installment Schedule (Optional)</label>
                  <button
                    type="button"
                    onClick={() =>
                      setObInstallments([
                        ...obInstallments,
                        { title: `Installment ${obInstallments.length + 1}`, amount: '', dueDate: obDueDate || '' },
                      ])
                    }
                    className="text-xs font-bold text-[#001A23] dark:text-[#E8F1F2] hover:opacity-75 cursor-pointer"
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

      {/* MODAL 2B: Update Reserved Money for Obligation */}
      {activeModal === 'RESERVE_OB' && selectedOb && (
        <div className="fixed inset-0 z-50 bg-[#001A23]/25 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-xl border ${
              darkMode
                ? 'bg-[#0E181C]/75 backdrop-blur-2xl border-[#E8F1F2]/15 text-[#E8F1F2]'
                : 'bg-white/60 backdrop-blur-2xl border-white/80 text-[#001A23]'
            }`}
          >
            <h3 className="font-bold text-lg mb-1">Update Reserved Funds</h3>
            <p className="text-xs opacity-75 mb-4">
              {selectedOb.title} • Currently Reserved: <strong>{formatBDT(selectedOb.reservedAmount)}</strong> of{' '}
              {formatBDT(Math.max(0, selectedOb.totalAmount - selectedOb.paidAmount))} remaining.
            </p>
            <form onSubmit={handleReserveObSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReserveMode('ADD')}
                  className={`py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    reserveMode === 'ADD' ? 'bg-[#31493C] text-[#B3EFB2]' : 'bg-[#E8F1F2] text-[#001A23]'
                  }`}
                >
                  Add to Reserve
                </button>
                <button
                  type="button"
                  onClick={() => setReserveMode('SET')}
                  className={`py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    reserveMode === 'SET' ? 'bg-[#31493C] text-[#B3EFB2]' : 'bg-[#E8F1F2] text-[#001A23]'
                  }`}
                >
                  Set Exact Reserve
                </button>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">
                  {reserveMode === 'ADD' ? 'Amount to Add to Reserve (৳)' : 'New Total Reserved Amount (৳)'}
                </label>
                <input
                  type="number"
                  required
                  value={reserveAmtInput}
                  onChange={setReserveAmtInput}
                  placeholder="e.g. 5000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
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

      {/* MODAL 2C: Explicit Payment Confirmation for Obligation */}
      {activeModal === 'PAY_OB' && selectedOb && (
        <div className="fixed inset-0 z-50 bg-[#001A23]/25 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-xl border ${
              darkMode
                ? 'bg-[#0E181C]/75 backdrop-blur-2xl border-[#E8F1F2]/15 text-[#E8F1F2]'
                : 'bg-white/60 backdrop-blur-2xl border-white/80 text-[#001A23]'
            }`}
          >
            <h3 className="font-bold text-lg mb-1">Record Obligation Payment</h3>
            <p className="text-xs opacity-75 mb-4">
              Confirming payment will deduct from your wallet, reduce your reserved balance, and log an expense in Recent Activity.
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
                      if (found) setPayAmountInput(String(Math.max(0, found.amount - found.paidAmount)));
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                  >
                    <option value="" className="text-[#001A23]">General Obligation Payment</option>
                    {selectedOb.installments
                      .filter((i) => !i.isPaid)
                      .map((inst) => (
                        <option key={inst.id} value={inst.id} className="text-[#001A23]">
                          {inst.title} — {formatBDT(inst.amount - inst.paidAmount)} due ({formatDateDDMMYYYY(inst.dueDate)})
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
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Payment Date</label>
                  <DDMMYYYYInput
                    required
                    value={payDateInput}
                    onChange={setPayDateInput}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Paid From Wallet</label>
                <select
                  value={payWalletId}
                  onChange={setPayWalletId}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                >
                  {data.wallets.map((w) => (
                    <option key={w.id} value={w.id} className="text-[#001A23]">
                      {w.name} ({formatBDT(w.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Note / Reference (Optional)</label>
                <input
                  type="text"
                  value={payNoteInput}
                  onChange={(e) => setPayNoteInput(e.target.value)}
                  placeholder="e.g. TrxID 9A8B7C"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
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

      {/* MODAL 2D: Create Custom Savings Entry */}
      {activeModal === 'CREATE_SAVINGS' && (
        <div className="fixed inset-0 z-50 bg-[#001A23]/25 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-xl border ${
              darkMode
                ? 'bg-[#0E181C]/75 backdrop-blur-2xl border-[#E8F1F2]/15 text-[#E8F1F2]'
                : 'bg-white/60 backdrop-blur-2xl border-white/80 text-[#001A23]'
            }`}
          >
            <h3 className="font-bold text-lg mb-1">New Savings Entry</h3>
            <p className="text-xs opacity-70 mb-4">
              Create any custom savings goal (e.g. Japan Trip, New Laptop, Emergency Funds) with no compulsory monthly contribution.
            </p>
            <form onSubmit={handleCreateSavingsSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold block mb-1">Savings Name</label>
                <input
                  type="text"
                  required
                  value={savName}
                  onChange={(e) => setSavName(e.target.value)}
                  placeholder="e.g. Japan Trip, New Laptop, Emergency Funds"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Initial Reserved (৳)</label>
                  <input
                    type="number"
                    value={savInitial}
                    onChange={(e) => setSavInitial(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Optional Target (৳)</label>
                  <input
                    type="number"
                    value={savTarget}
                    onChange={(e) => setSavTarget(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Target Date (Optional)</label>
                  <DDMMYYYYInput
                    value={savTargetDate}
                    onChange={setSavTargetDate}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={savNotes}
                    onChange={setSavNotes}
                    placeholder="Optional note"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
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

      {/* MODAL 2E: Savings Deposit / Withdraw to Wallet / Spend / Edit Balance */}
      {activeModal === 'SAVINGS_ACTION' && selectedSavings && (
        <div className="fixed inset-0 z-50 bg-[#001A23]/25 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-xl border ${
              darkMode
                ? 'bg-[#0E181C]/75 backdrop-blur-2xl border-[#E8F1F2]/15 text-[#E8F1F2]'
                : 'bg-white/60 backdrop-blur-2xl border-white/80 text-[#001A23]'
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

              <p className="text-[11px] opacity-75">
                {savActionMode === 'DEPOSIT' &&
                  "Sets money aside in savings. Total money owned stays unchanged; no expense is recorded."}
                {savActionMode === 'WITHDRAW' &&
                  "Releases savings back into your available-to-spend balance. Does NOT count as an expense."}
                {savActionMode === 'SPEND' &&
                  "Deducts from savings AND your chosen wallet, and records a real expense in Recent Activity."}
                {savActionMode === 'EDIT_BALANCE' &&
                  "Manually set the exact current saved balance for this entry."}
              </p>

              <div>
                <label className="text-xs font-semibold block mb-1">
                  {savActionMode === 'EDIT_BALANCE' ? 'New Saved Balance (৳)' : 'Amount (৳)'}
                </label>
                <input
                  type="number"
                  required
                  value={savActionAmount}
                  onChange={(e) => setSavActionAmount(e.target.value)}
                  placeholder="e.g. 2000"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
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
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
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
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
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
                  placeholder="Optional description"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
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

      {/* MODAL 2F: Savings Entry Transaction History */}
      {activeModal === 'SAVINGS_HISTORY' && selectedSavings && (
        <div className="fixed inset-0 z-50 bg-[#001A23]/25 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-xl border ${
              darkMode
                ? 'bg-[#0E181C]/75 backdrop-blur-2xl border-[#E8F1F2]/15 text-[#E8F1F2]'
                : 'bg-white/60 backdrop-blur-2xl border-white/80 text-[#001A23]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-lg">{selectedSavings.name} — History</h3>
                <p className="text-xs opacity-70">Current Saved Balance: {formatBDT(selectedSavings.currentBalance)}</p>
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
                        {formatDateDDMMYYYY(st.date)}{st.note ? ` • ${st.note}` : ""}
                      </p>
                    </div>
                    <span
                      className={`font-bold ${
                        st.type === 'DEPOSIT' ? "text-[#7A9E7E]" : "text-[#D52073]"
                      }`}
                    >
                      {st.type === 'DEPOSIT' ? "+" : "-"}{formatBDT(st.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Smart Restaurant & Group Bill Splitter */}
      {activeModal === 'SPLIT' && (
        <div className="fixed inset-0 z-50 bg-[#001A23]/25 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`w-full max-w-lg rounded-3xl p-6 shadow-xl border my-8 ${
              darkMode
                ? 'bg-[#0E181C]/75 backdrop-blur-2xl border-[#E8F1F2]/15 text-[#E8F1F2]'
                : 'bg-white/60 backdrop-blur-2xl border-white/80 text-[#001A23]'
            }`}
          >
            <h3 className="font-bold text-lg mb-1">Smart Bill Splitter</h3>
            <p className="text-xs opacity-70 mb-4">
              Split equally or by individual food items with automatic proportional VAT.
            </p>

            <form onSubmit={handleSplitSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Restaurant / Event Name</label>
                <input
                  type="text"
                  required
                  value={splitTitle}
                  onChange={(e) => setSplitTitle(e.target.value)}
                  placeholder="e.g. Sultan's Dine Lunch"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                />
              </div>

              {/* Split Mode Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSplitMode('ITEMIZED')}
                  className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    splitMode === 'ITEMIZED'
                      ? 'bg-[#31493C] text-[#B3EFB2]'
                      : 'bg-[#E8F1F2] text-[#001A23]'
                  }`}
                >
                  By Individual Food + VAT
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('EQUAL')}
                  className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    splitMode === 'EQUAL'
                      ? 'bg-[#31493C] text-[#B3EFB2]'
                      : 'bg-[#E8F1F2] text-[#001A23]'
                  }`}
                >
                  Split Equally
                </button>
              </div>

              {/* Equal Mode Subtotal Input */}
              {splitMode === 'EQUAL' && (
                <div>
                  <label className="text-xs font-semibold block mb-1">Subtotal Before VAT (৳)</label>
                  <input
                    type="number"
                    required
                    value={equalTotalBill}
                    onChange={(e) => setEqualTotalBill(e.target.value)}
                    placeholder="e.g. 2000"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                  />
                </div>
              )}

              {/* VAT / Service Charge Input */}
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="col-span-2">
                  <label className="text-xs font-semibold block mb-1">
                    VAT & Service Charge ({vatIsPercent ? '%' : '৳'})
                  </label>
                  <input
                    type="number"
                    value={splitVatInput}
                    onChange={(e) => setSplitVatInput(e.target.value)}
                    placeholder={vatIsPercent ? 'e.g. 15' : 'e.g. 300'}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#7A9E7E]/30 bg-transparent text-sm outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setVatIsPercent(!vatIsPercent)}
                  className="py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer"
                >
                  Switch to {vatIsPercent ? '৳ Fixed' : '% Rate'}
                </button>
              </div>

              {/* People List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold">People ({splitPeople.length})</label>
                  <button
                    type="button"
                    onClick={() =>
                      setSplitPeople([
                        ...splitPeople,
                        { name: `Friend ${splitPeople.length}`, isMe: false, itemTotal: '', cashGiven: '' },
                      ])
                    }
                    className="text-xs font-bold text-[#001A23] dark:text-[#E8F1F2] hover:opacity-75 cursor-pointer"
                  >
                    + Add Person
                  </button>
                </div>

                {splitPeople.map((person, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      value={person.name}
                      disabled={person.isMe}
                      onChange={(e) => {
                        const updated = [...splitPeople];
                        updated[idx].name = e.target.value;
                        setSplitPeople(updated);
                      }}
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl border bg-transparent text-xs"
                    />
                    {splitMode === 'ITEMIZED' && (
                      <input
                        type="number"
                        required
                        placeholder="Food ৳"
                        value={person.itemTotal}
                        onChange={(e) => {
                          const updated = [...splitPeople];
                          updated[idx].itemTotal = e.target.value;
                          setSplitPeople(updated);
                        }}
                        className="w-24 px-2.5 py-2 rounded-xl border bg-transparent text-xs"
                      />
                    )}
                    <input
                      type="number"
                      min={0}
                      placeholder="Gave ৳"
                      title="Cash given by this person (optional)"
                      value={person.cashGiven}
                      onChange={(e) => {
                        const updated = [...splitPeople];
                        updated[idx].cashGiven = e.target.value;
                        setSplitPeople(updated);
                      }}
                      className="w-24 px-2.5 py-2 rounded-xl border bg-transparent text-xs"
                    />
                    {!person.isMe && splitPeople.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSplitPeople(splitPeople.filter((_, i) => i !== idx))
                        }
                        className="p-1.5 text-[#D52073] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Live Calculation Breakdown Box */}
              <div className="p-3.5 rounded-2xl bg-[#31493C] text-[#E8F1F2] text-xs space-y-1.5">
                <div className="flex justify-between font-bold text-sm text-[#B3EFB2]">
                  <span>Grand Total (incl. {activeCurrencySymbol}{preview.vatAmount.toFixed(2)} VAT):</span>
                  <span>{activeCurrencySymbol}{preview.grandTotal.toFixed(2)}</span>
                </div>
                {preview.breakdown.map((b, i) => {
                  const hasCash = b.cashGiven > 0;
                  const diff = b.cashGiven - b.finalOwed;
                  return (
                    <div key={i} className="flex justify-between items-center opacity-95 gap-2">
                      <span>
                        {b.name}: Share {activeCurrencySymbol}{b.finalOwed.toFixed(2)}
                        {hasCash ? ` (Gave ৳${b.cashGiven.toFixed(2)})` : ""}
                      </span>
                      <span className="font-bold text-right">
                        {hasCash ? (
                          <span className={diff >= 0 ? "text-[#FFEF5C]" : "text-[#D52073]"}>
                            {diff >= 0
                              ? `Gets back ৳${diff.toFixed(2)}`
                              : `Owes ৳${Math.abs(diff).toFixed(2)} more`}
                          </span>
                        ) : (
                          `৳${b.finalOwed.toFixed(2)}`
                        )}
                      </span>
                    </div>
                  );
                })}
                {preview.breakdown.some((b) => b.cashGiven > 0) && (() => {
                  const totalCashGiven = preview.breakdown.reduce((s, b) => s + b.cashGiven, 0);
                  const totalChange = totalCashGiven - preview.grandTotal;
                  return (
                    <div className="pt-1.5 mt-1.5 border-t border-[#E8F1F2]/20 flex justify-between font-bold text-[#FFEF5C]">
                      <span>Total Cash Given: {activeCurrencySymbol}{totalCashGiven.toFixed(2)}</span>
                      <span>
                        {totalChange >= 0
                          ? `Total Change Back: ৳${totalChange.toFixed(2)}`
                          : `Total Short: ৳${Math.abs(totalChange).toFixed(2)}`}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Who Paid Toggle */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold block">Who paid at the counter?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaidByMe(true)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                      paidByMe
                        ? "bg-[#B3EFB2] text-[#001A23]"
                        : "bg-[#E8F1F2] text-[#001A23] opacity-75"
                    }`}
                  >
                    I Paid (Friends Owe Me)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaidByMe(false)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                      !paidByMe
                        ? "bg-[#D52073] text-white"
                        : "bg-[#E8F1F2] text-[#001A23] opacity-75"
                    }`}
                  >
                    Friend Paid (I Owe Share)
                  </button>
                </div>

                {paidByMe ? (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="opacity-80">Deduct total bill from:</span>
                    <select
                      value={splitWalletId}
                      onChange={(e) => setSplitWalletId(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#7A9E7E]/30 bg-transparent text-xs outline-none"
                    >
                      {data.wallets.map((w) => (
                        <option key={w.id} value={w.id} className="text-[#001A23]">
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-[11px] opacity-75 pt-1">
                    Your share will be reserved in Obligations until you settle it.
                  </p>
                )}
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
                  {submitting ? 'Saving...' : 'Save & Split Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add / Edit Wallet Modal */}
      {walletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div
            className={`w-full max-w-md rounded-3xl p-6 border ${
              darkMode
                ? "bg-black border-[#31493C] text-[#E8F1F2]"
                : "bg-white border-[#7A9E7E]/30 text-[#001A23]"
            }`}
          >
            <h3 className="text-lg font-extrabold mb-1">
              {editingWallet ? "Edit Wallet" : "Add New Wallet"}
            </h3>
            <p className="text-xs opacity-70 mb-4">
              {editingWallet
                ? "Update wallet details or adjust your current balance"
                : "Add an MFS account, bank card, or cash stash"}
            </p>

            <form onSubmit={handleSaveWallet} className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Wallet Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Nagad Personal, City Bank, Savings"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-sm border outline-none ${
                    darkMode
                      ? "bg-[#31493C]/20 border-[#31493C] text-[#E8F1F2]"
                      : "bg-[#E8F1F2]/50 border-[#7A9E7E]/30"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Type</label>
                  <select
                    value={walletType}
                    onChange={(e) => setWalletType(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2 text-sm border outline-none ${
                      darkMode
                        ? "bg-[#31493C]/20 border-[#31493C] text-[#E8F1F2]"
                        : "bg-[#E8F1F2]/50 border-[#7A9E7E]/30"
                    }`}
                  >
                    <option value="MFS">MFS (bKash / Nagad / Rocket)</option>
                    <option value="BANK">Bank Account</option>
                    <option value="CASH">Cash</option>
                    <option value="SAVINGS">Savings Vault</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">Current Balance (৳)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0"
                    value={walletBalance}
                    onChange={(e) => setWalletBalance(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2 text-sm border outline-none ${
                      darkMode
                        ? "bg-[#31493C]/20 border-[#31493C] text-[#E8F1F2]"
                        : "bg-[#E8F1F2]/50 border-[#7A9E7E]/30"
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setWalletModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold opacity-70 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#B3EFB2] text-[#001A23] cursor-pointer"
                >
                  {submitting ? "Saving..." : editingWallet ? "Save Changes" : "Create Wallet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
