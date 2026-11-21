'use client';

/**
 * @file app/split/page.tsx
 * @description Complete 7-Step Bill Splitting & Settlement Workspace integrated with PocketQ wallets and ledger.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Sun,
  Moon,
  Receipt,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  ArrowRight,
  Percent,
  Split,
  UserPlus,
  History,
  Check,
} from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import { formatDateDDMMYYYY } from '@/lib/format';
import {
  calculateBillSplit,
  ParticipantDraft,
  BillItemDraft,
  ItemAllocationGroupDraft,
  ExtraChargeDraft,
  SplitMode,
  VatMode,
  ChargeInputType,
  DiscountTiming,
  GroupSplitType,
} from '@/lib/bill-split';

interface WalletItem {
  id: string;
  name: string;
  balance: number;
}

interface SavedSettlement {
  id: string;
  amount: number;
  paidAmount: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID';
  paidDate: string | null;
  note: string | null;
  fromParticipant: { id: string; name: string; isMe: boolean };
  toParticipant: { id: string; name: string; isMe: boolean };
}

interface SavedParticipant {
  id: string;
  name: string;
  isMe: boolean;
  paidAmount: number;
  individualTotal: number;
  sharedTotal: number;
  itemTotal: number;
  vatShare: number;
  chargesShare: number;
  discountShare: number;
  finalOwed: number;
  isSettled: boolean;
}

interface SavedBillSplit {
  id: string;
  title: string;
  notes: string | null;
  subtotal: number;
  vatMode: string;
  vatAmount: number;
  discountAmount: number;
  serviceChargeAmt: number;
  otherChargesTotal: number;
  totalAmount: number;
  splitMode: string;
  status: 'CONFIRMED' | 'SETTLED';
  date: string;
  participants: SavedParticipant[];
  settlements: SavedSettlement[];
}

const uid = () => Math.random().toString(36).slice(2, 10);

export default function BillSplittingPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [currency, setCurrency] = useState('৳');
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [savedBills, setSavedBills] = useState<SavedBillSplit[]>([]);

  // Active tab: 'NEW' builder vs 'HISTORY' settlements
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');

  // Step 1: Bill Metadata & Participants
  const [title, setTitle] = useState('');
  const [billDate, setBillDate] = useState('');
  const [notes, setNotes] = useState('');
  const [participants, setParticipants] = useState<ParticipantDraft[]>([
    { id: 'p-1', name: 'Person 1', isMe: false, paidAmount: 0, walletId: null },
    { id: 'p-2', name: 'Person 2', isMe: false, paidAmount: 0, walletId: null },
  ]);
  const [newParticipantName, setNewParticipantName] = useState('');

  // Step 2: Bill Items
  const [items, setItems] = useState<BillItemDraft[]>([
    { id: 'item-1', name: '', quantity: 1, unitPrice: 0, groups: [] },
  ]);

  // Step 3: Split Mode ('ITEMIZED' | 'EQUAL')
  const [splitMode, setSplitMode] = useState<SplitMode>('ITEMIZED');

  // Step 4: VAT, Service Charges, Delivery, Custom Charges & Discounts
  const [vatMode, setVatMode] = useState<VatMode>('EXCLUSIVE');
  const [vatType, setVatType] = useState<ChargeInputType>('PERCENT');
  const [vatValue, setVatValue] = useState<number>(0);

  const [serviceChargeType, setServiceChargeType] = useState<ChargeInputType>('PERCENT');
  const [serviceChargeValue, setServiceChargeValue] = useState<number>(0);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [extraCharges, setExtraCharges] = useState<ExtraChargeDraft[]>([]);

  const [discountTiming, setDiscountTiming] = useState<DiscountTiming>('BEFORE_VAT');
  const [discountType, setDiscountType] = useState<ChargeInputType>('FIXED');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Step 6: Payer selection mode ('SINGLE' vs 'MULTI')
  const [payerMode, setPayerMode] = useState<'SINGLE' | 'MULTI'>('SINGLE');
  const [singlePayerId, setSinglePayerId] = useState<string>('p-1');

  // Step 7: Settlement Modal State
  const [settlingTarget, setSettlingTarget] = useState<{
    billId: string;
    billTitle: string;
    settlement: SavedSettlement;
  } | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleDate, setSettleDate] = useState<string>('');
  const [settleWalletId, setSettleWalletId] = useState<string>('');
  const [settleNote, setSettleNote] = useState<string>('');
  const [settlingBusy, setSettlingBusy] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/bill-splits');
      if (!res.ok) throw new Error('Failed to load bill splits');
      const data = await res.json();
      setCurrency(data.currencySymbol || '৳');
      setCurrentUser(data.user || null);
      setWallets(data.wallets || []);
      setSavedBills(data.billSplits || []);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load bill splitting workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setBillDate((prev) => prev || today);
    setSettleDate((prev) => prev || today);
    loadData();
  }, []);

  // Live Calculation Engine
  const liveCalc = useMemo(() => {
    return calculateBillSplit({
      splitMode,
      participants,
      items,
      vatMode,
      vatType,
      vatValue,
      discountTiming,
      discountType,
      discountValue,
      serviceChargeType,
      serviceChargeValue,
      deliveryCharge,
      extraCharges,
    });
  }, [
    splitMode,
    participants,
    items,
    vatMode,
    vatType,
    vatValue,
    discountTiming,
    discountType,
    discountValue,
    serviceChargeType,
    serviceChargeValue,
    deliveryCharge,
    extraCharges,
  ]);

  // Keep single-payer amount synced with live final total automatically
  useEffect(() => {
    if (payerMode !== 'SINGLE' || participants.length === 0) return;
    const validPayer = participants.some((p) => p.id === singlePayerId)
      ? singlePayerId
      : participants[0].id;
    if (validPayer !== singlePayerId) {
      setSinglePayerId(validPayer);
    }

    setParticipants((prev) => {
      const needsUpdate = prev.some((p) =>
        p.id === validPayer
          ? Math.abs(p.paidAmount - liveCalc.finalTotal) > 0.005
          : p.paidAmount !== 0
      );
      if (!needsUpdate) return prev;
      return prev.map((p) => ({
        ...p,
        paidAmount: p.id === validPayer ? liveCalc.finalTotal : 0,
      }));
    });
  }, [payerMode, singlePayerId, liveCalc.finalTotal, participants.length]);

  // --- Participant Actions ---
  const addParticipant = (customName?: string, isMe = false) => {
    if (isMe && participants.some((p) => p.isMe)) return;
    const trimmed = (customName ?? newParticipantName).trim();
    const label = isMe
      ? `${currentUser?.name || 'Me'} (Me)`
      : trimmed || `Person ${participants.length + 1}`;

    const newP: ParticipantDraft = {
      id: `p-${uid()}`,
      name: label,
      isMe,
      paidAmount: 0,
      walletId: isMe && wallets.length > 0 ? wallets[0].id : null,
    };
    setParticipants((prev) => [...prev, newP]);
    if (!customName) setNewParticipantName('');
  };

  const removeParticipant = (id: string) => {
    if (participants.length <= 1) return;
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    // Clean up assignments referencing removed participant
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        groups: it.groups
          .map((g) => ({
            ...g,
            entries: g.entries.filter((e) => e.participantId !== id),
          }))
          .filter((g) => g.entries.length > 0),
      }))
    );
  };

  // --- Item Actions ---
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: `item-${uid()}`, name: '', quantity: 1, unitPrice: 0, groups: [] },
    ]);
  };

  const updateItem = (id: string, patch: Partial<BillItemDraft>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // --- Assignment Group Actions ---
  const addAssignmentGroup = (item: BillItemDraft, mode: 'SINGLE' | 'SHARED') => {
    const status = liveCalc.itemStatuses.find((s) => s.itemId === item.id);
    const defaultQty = status && status.remainingQuantity > 0 ? status.remainingQuantity : 1;

    const initialEntries =
      mode === 'SINGLE'
        ? [{ participantId: participants[0]?.id || '' }]
        : participants.slice(0, Math.min(2, participants.length)).map((p) => ({
            participantId: p.id,
            percentage: Math.round((100 / Math.min(2, participants.length)) * 100) / 100,
            customAmount: 0,
          }));

    const newGroup: ItemAllocationGroupDraft = {
      id: `grp-${uid()}`,
      mode,
      quantity: defaultQty,
      splitType: 'EQUAL',
      entries: initialEntries.filter((e) => e.participantId),
    };

    updateItem(item.id, { groups: [...item.groups, newGroup] });
  };

  const updateGroup = (
    itemId: string,
    groupId: string,
    updater: (g: ItemAllocationGroupDraft) => ItemAllocationGroupDraft
  ) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              groups: it.groups.map((g) => (g.id === groupId ? updater(g) : g)),
            }
          : it
      )
    );
  };

  const removeGroup = (itemId: string, groupId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, groups: it.groups.filter((g) => g.id !== groupId) }
          : it
      )
    );
  };

  const toggleGroupParticipant = (
    itemId: string,
    group: ItemAllocationGroupDraft,
    participantId: string
  ) => {
    if (group.mode === 'SINGLE') {
      updateGroup(itemId, group.id, (g) => ({
        ...g,
        entries: [{ participantId }],
      }));
      return;
    }

    const exists = group.entries.some((e) => e.participantId === participantId);
    const nextEntries = exists
      ? group.entries.filter((e) => e.participantId !== participantId)
      : [...group.entries, { participantId, percentage: 0, customAmount: 0 }];

    // Rebalance default percentages neatly when toggling
    const evenPct =
      nextEntries.length > 0 ? Math.round((100 / nextEntries.length) * 100) / 100 : 0;

    updateGroup(itemId, group.id, (g) => ({
      ...g,
      entries: nextEntries.map((e, i) => ({
        ...e,
        percentage:
          i === nextEntries.length - 1
            ? Math.round((100 - evenPct * (nextEntries.length - 1)) * 100) / 100
            : evenPct,
      })),
    }));
  };

  // --- Extra Charges ---
  const addExtraCharge = () => {
    setExtraCharges((prev) => [
      ...prev,
      { id: `chg-${uid()}`, label: 'Packaging / Container', type: 'FIXED', value: 0 },
    ]);
  };

  // --- Submit & Confirm Bill ---
  const handleConfirmBill = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!liveCalc.isValid) {
      setErrorMsg(liveCalc.validationErrors[0] || 'Please fix validation warnings before confirming.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/bill-splits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Shared Bill',
          date: billDate,
          notes,
          splitMode,
          participants,
          items,
          vatMode,
          vatType,
          vatValue,
          discountTiming,
          discountType,
          discountValue,
          serviceChargeType,
          serviceChargeValue,
          deliveryCharge,
          extraCharges,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save bill split');
      }

      setSuccessMsg('Bill split confirmed and synced with your PocketQ ledger!');
      // Reset form for next bill
      setTitle('');
      setNotes('');
      setItems([{ id: `item-${uid()}`, name: '', quantity: 1, unitPrice: 0, groups: [] }]);
      setVatValue(0);
      setServiceChargeValue(0);
      setDeliveryCharge(0);
      setExtraCharges([]);
      setDiscountValue(0);
      await loadData();
      setActiveTab('HISTORY');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error confirming bill');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Record Settlement Payment ---
  const openSettlementModal = (bill: SavedBillSplit, settlement: SavedSettlement) => {
    const remaining = Math.max(0, Math.round((settlement.amount - settlement.paidAmount) * 100) / 100);
    setSettlingTarget({ billId: bill.id, billTitle: bill.title, settlement });
    setSettleAmount(String(remaining));
    setSettleDate(new Date().toISOString().slice(0, 10));
    setSettleWalletId(
      (settlement.toParticipant.isMe || settlement.fromParticipant.isMe) && wallets.length > 0
        ? wallets[0].id
        : ''
    );
    setSettleNote('');
  };

  const handleRecordSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingTarget) return;

    try {
      setSettlingBusy(true);
      setErrorMsg(null);
      const res = await fetch(`/api/bill-splits/${settlingTarget.billId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settlementId: settlingTarget.settlement.id,
          paymentAmount: Number(settleAmount),
          paidDate: settleDate,
          walletId: settleWalletId || null,
          note: settleNote,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record settlement');

      setSettlingTarget(null);
      setSuccessMsg('Settlement updated and wallet balance synced!');
      await loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update settlement');
    } finally {
      setSettlingBusy(false);
    }
  };

  const handleDeleteBill = async (billId: string) => {
    if (!confirm('Delete this saved bill split record?')) return;
    try {
      const res = await fetch(`/api/bill-splits/${billId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete bill');
      await loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not delete bill');
    }
  };

  const pendingReceivables = useMemo(() => {
    let total = 0;
    for (const b of savedBills) {
      for (const s of b.settlements) {
        if (s.toParticipant.isMe && s.status !== 'PAID') {
          total += Math.max(0, s.amount - s.paidAmount);
        }
      }
    }
    return Math.round(total * 100) / 100;
  }, [savedBills]);

  const pendingPayables = useMemo(() => {
    let total = 0;
    for (const b of savedBills) {
      for (const s of b.settlements) {
        if (s.fromParticipant.isMe && s.status !== 'PAID') {
          total += Math.max(0, s.amount - s.paidAmount);
        }
      }
    }
    return Math.round(total * 100) / 100;
  }, [savedBills]);

  const cardClass = darkMode
    ? 'bg-[#07262E] border-[#31493C] text-[#E8F1F2]'
    : 'bg-white border-[#7A9E7E]/25 text-[#001A23]';

  const inputClass = darkMode
    ? 'bg-[#001A23] border-[#31493C] text-[#E8F1F2] focus:border-[#B3EFB2]'
    : 'bg-[#F7FAFA] border-[#7A9E7E]/30 text-[#001A23] focus:border-[#31493C]';

  return (
    <div
      className={`min-h-screen transition-colors ${
        darkMode ? 'bg-[#001A23] text-[#E8F1F2]' : 'bg-[#E8F1F2]/60 text-[#001A23]'
      }`}
    >
      {/* Top Header */}
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md ${
          darkMode
            ? 'bg-[#001A23]/90 border-[#31493C]'
            : 'bg-white/90 border-[#7A9E7E]/25'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AppSidebar darkMode={darkMode} />
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#31493C] dark:text-[#B3EFB2]" />
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  Bill Splitting &amp; Settlements
                </h1>
              </div>
              <p className="text-xs opacity-70">
                Itemized &amp; equal splitting with proportional VAT, shared dishes &amp; wallet sync
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl p-1 border border-[#7A9E7E]/30 bg-[#7A9E7E]/10">
              <button
                type="button"
                onClick={() => setActiveTab('NEW')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'NEW'
                    ? 'bg-[#31493C] text-[#B3EFB2] shadow-xs'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                + Split New Bill
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('HISTORY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'HISTORY'
                    ? 'bg-[#31493C] text-[#B3EFB2] shadow-xs'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Bills &amp; Settlements ({savedBills.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label="Toggle theme"
              className={`p-2 rounded-xl border transition cursor-pointer ${
                darkMode
                  ? 'bg-[#31493C]/50 border-[#31493C] text-[#B3EFB2]'
                  : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
              }`}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Global Status Banners */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl border border-[#D52073]/40 bg-[#D52073]/10 text-[#D52073] text-xs font-semibold flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </span>
            <button type="button" onClick={() => setErrorMsg(null)} className="underline">
              Dismiss
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl border border-[#31493C]/40 bg-[#B3EFB2]/30 text-[#001A23] dark:text-[#B3EFB2] text-xs font-semibold flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {successMsg}
            </span>
            <button type="button" onClick={() => setSuccessMsg(null)} className="underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Top KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`p-4 rounded-2xl border ${cardClass}`}>
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-65">
              Owed To You (Pending)
            </span>
            <p className="text-xl font-extrabold mt-1 text-[#31493C] dark:text-[#B3EFB2]">
              {currency}
              {pendingReceivables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] opacity-65">
              Excluded from income until settled into wallet
            </span>
          </div>
          <div className={`p-4 rounded-2xl border ${cardClass}`}>
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-65">
              You Owe Others (Pending)
            </span>
            <p className="text-xl font-extrabold mt-1 text-[#D52073]">
              {currency}
              {pendingPayables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] opacity-65">
              Unsettled shares from group bills paid by friends
            </span>
          </div>
          <div className={`p-4 rounded-2xl border ${cardClass}`}>
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-65">
              Total Split Bills Tracked
            </span>
            <p className="text-xl font-extrabold mt-1">{savedBills.length}</p>
            <span className="text-[11px] opacity-65">
              {savedBills.filter((b) => b.status === 'SETTLED').length} fully settled
            </span>
          </div>
        </div>

        {activeTab === 'NEW' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Steps 1 - 4 & Step 6 */}
            <div className="lg:col-span-8 space-y-6">
              {/* STEP 1: Bill Info & Participants */}
              <section className={`p-5 rounded-2xl border space-y-4 ${cardClass}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#31493C] dark:text-[#B3EFB2]">
                      Step 1
                    </span>
                    <h2 className="text-base font-extrabold">Bill Details &amp; Participants</h2>
                  </div>
                  <Users className="w-4 h-4 opacity-60" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold block mb-1 opacity-75">
                      Bill Title / Restaurant (Optional)
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Sultan's Dine Dinner, Team Lunch"
                      className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold block mb-1 opacity-75">Bill Date</label>
                    <input
                      type="date"
                      value={billDate}
                      onChange={(e) => setBillDate(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${inputClass}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold block mb-1 opacity-75">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional receipt reference or occasion note"
                    className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${inputClass}`}
                  />
                </div>

                {/* Participants Manager */}
                <div className="pt-2 border-t border-[#7A9E7E]/20 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold">
                      Participants ({participants.length})
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {!participants.some((p) => p.isMe) && (
                        <button
                          type="button"
                          onClick={() => addParticipant(undefined, true)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#31493C] text-[#B3EFB2] hover:opacity-90 transition cursor-pointer flex items-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" /> + Include Me ({currentUser?.name || 'Me'})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => addParticipant(`Person ${participants.length + 1}`, false)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-[#7A9E7E]/40 hover:bg-[#7A9E7E]/15 transition cursor-pointer"
                      >
                        + Person {participants.length + 1}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newParticipantName}
                      onChange={(e) => setNewParticipantName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addParticipant();
                        }
                      }}
                      placeholder="Enter participant name (or leave blank for default label)"
                      className={`flex-1 px-3 py-2 rounded-xl border text-xs outline-none ${inputClass}`}
                    />
                    <button
                      type="button"
                      onClick={() => addParticipant()}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] hover:opacity-90 transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {participants.map((p) => (
                      <div
                        key={p.id}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                          p.isMe
                            ? 'bg-[#31493C]/15 border-[#31493C] text-[#31493C] dark:text-[#B3EFB2]'
                            : 'border-[#7A9E7E]/30'
                        }`}
                      >
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) =>
                            setParticipants((prev) =>
                              prev.map((item) =>
                                item.id === p.id ? { ...item, name: e.target.value } : item
                              )
                            )
                          }
                          className="bg-transparent outline-none w-28 sm:w-32 font-bold"
                        />
                        {participants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeParticipant(p.id)}
                            aria-label={`Remove ${p.name}`}
                            className="opacity-60 hover:opacity-100 hover:text-[#D52073] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* STEP 2: Add Bill Items */}
              <section className={`p-5 rounded-2xl border space-y-4 ${cardClass}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#31493C] dark:text-[#B3EFB2]">
                      Step 2
                    </span>
                    <h2 className="text-base font-extrabold">Add Bill Items</h2>
                    <p className="text-[11px] opacity-70">
                      Enter items, quantities, and unit prices first. You will assign who shared them in Step 3.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] hover:opacity-90 transition cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-[11px] font-bold opacity-65 px-1">
                    <span className="col-span-5">Item Name</span>
                    <span className="col-span-2">Qty</span>
                    <span className="col-span-2">Unit Price ({currency})</span>
                    <span className="col-span-2 text-right">Subtotal</span>
                    <span className="col-span-1" />
                  </div>

                  {items.map((item, idx) => {
                    const sub =
                      Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) * 100) /
                      100;
                    return (
                      <div
                        key={item.id}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-xl border border-[#7A9E7E]/20"
                      >
                        <div className="sm:col-span-5">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(item.id, { name: e.target.value })}
                            placeholder={`Item ${idx + 1} (e.g., Burger, Pizza)`}
                            className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none ${inputClass}`}
                          />
                        </div>
                        <div className="grid grid-cols-3 sm:col-span-6 gap-2 items-center">
                          <div>
                            <label className="sm:hidden text-[10px] opacity-65 block">Qty</label>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={item.quantity || ''}
                              onChange={(e) =>
                                updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })
                              }
                              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none ${inputClass}`}
                            />
                          </div>
                          <div>
                            <label className="sm:hidden text-[10px] opacity-65 block">Price</label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.unitPrice || ''}
                              onChange={(e) =>
                                updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })
                              }
                              placeholder="0"
                              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none ${inputClass}`}
                            />
                          </div>
                          <div className="text-right font-extrabold text-xs">
                            <span className="sm:hidden text-[10px] opacity-65 block">Subtotal</span>
                            {currency}
                            {sub.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              aria-label="Delete item"
                              className="p-1.5 rounded-lg opacity-65 hover:opacity-100 hover:text-[#D52073] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* STEP 3: Splitting Mode & Item Assignment */}
              <section className={`p-5 rounded-2xl border space-y-4 ${cardClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#31493C] dark:text-[#B3EFB2]">
                      Step 3
                    </span>
                    <h2 className="text-base font-extrabold">Assign Items or Split Equally</h2>
                  </div>

                  {/* Mode Switcher */}
                  <div className="inline-flex rounded-xl p-1 border border-[#7A9E7E]/30 bg-[#7A9E7E]/10">
                    <button
                      type="button"
                      onClick={() => setSplitMode('ITEMIZED')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        splitMode === 'ITEMIZED'
                          ? 'bg-[#31493C] text-[#B3EFB2]'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                    >
                      <Split className="w-3.5 h-3.5" /> Item-Based Split
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitMode('EQUAL')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        splitMode === 'EQUAL'
                          ? 'bg-[#31493C] text-[#B3EFB2]'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                    >
                      Split Equally ({participants.length})
                    </button>
                  </div>
                </div>

                {splitMode === 'EQUAL' ? (
                  <div className="p-4 rounded-xl border border-[#31493C]/30 bg-[#31493C]/10 text-xs space-y-1">
                    <p className="font-bold">
                      Equal Bill Splitting Active ({participants.length} participants)
                    </p>
                    <p className="opacity-80">
                      The final total including VAT, service charges, extra fees, and discounts (
                      {currency}
                      {liveCalc.finalTotal.toFixed(2)}) is divided equally among all participants,
                      with automatic rounding reconciliation. Switch back to{' '}
                      <strong>Item-Based Split</strong> anytime without losing your items.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item, idx) => {
                      const status = liveCalc.itemStatuses.find((s) => s.itemId === item.id);
                      const itemSub =
                        Math.round(
                          (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) * 100
                        ) / 100;

                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-2xl border space-y-3 ${
                            status?.isOverAssigned
                              ? 'border-[#D52073]'
                              : status?.isFullyAssigned
                              ? 'border-[#31493C]/40'
                              : 'border-amber-500/50'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-extrabold text-sm">
                                {item.name.trim() || `Item ${idx + 1}`}
                              </span>
                              <span className="text-xs opacity-70 ml-2">
                                ({item.quantity} × {currency}
                                {item.unitPrice} = {currency}
                                {itemSub.toFixed(2)})
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {status?.isFullyAssigned ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#B3EFB2]/30 text-[#31493C] dark:text-[#B3EFB2]">
                                  Fully Assigned
                                </span>
                              ) : status?.isOverAssigned ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#D52073]/15 text-[#D52073]">
                                  Over-assigned!
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                  Remaining qty: {status?.remainingQuantity ?? item.quantity}
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => addAssignmentGroup(item, 'SINGLE')}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-[#7A9E7E]/40 hover:bg-[#7A9E7E]/15 cursor-pointer"
                              >
                                + 1 Person
                              </button>
                              <button
                                type="button"
                                onClick={() => addAssignmentGroup(item, 'SHARED')}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#31493C] text-[#B3EFB2] hover:opacity-90 cursor-pointer"
                              >
                                + Share Group
                              </button>
                            </div>
                          </div>

                          {item.groups.length === 0 ? (
                            <p className="text-xs opacity-65 italic">
                              No one assigned yet. Click <strong>+ 1 Person</strong> or{' '}
                              <strong>+ Share Group</strong> above to assign quantities.
                            </p>
                          ) : (
                            <div className="space-y-2.5">
                              {item.groups.map((group) => {
                                const portionCost =
                                  item.quantity > 0
                                    ? Math.round(((itemSub * group.quantity) / item.quantity) * 100) /
                                      100
                                    : 0;

                                return (
                                  <div
                                    key={group.id}
                                    className="p-3 rounded-xl border border-[#7A9E7E]/25 bg-[#7A9E7E]/5 space-y-2.5"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="font-bold">
                                          {group.mode === 'SINGLE'
                                            ? 'Individual Portion'
                                            : 'Shared Portion'}
                                        </span>
                                        <label className="inline-flex items-center gap-1 opacity-80">
                                          Qty:
                                          <input
                                            type="number"
                                            min="0.01"
                                            step="any"
                                            value={group.quantity || ''}
                                            onChange={(e) =>
                                              updateGroup(item.id, group.id, (g) => ({
                                                ...g,
                                                quantity: parseFloat(e.target.value) || 0,
                                              }))
                                            }
                                            className={`w-16 px-2 py-0.5 rounded-lg border text-xs ${inputClass}`}
                                          />
                                        </label>
                                        <span className="font-bold text-[#31493C] dark:text-[#B3EFB2]">
                                          ({currency}
                                          {portionCost.toFixed(2)})
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        {group.mode === 'SHARED' && (
                                          <select
                                            value={group.splitType}
                                            onChange={(e) =>
                                              updateGroup(item.id, group.id, (g) => ({
                                                ...g,
                                                splitType: e.target.value as GroupSplitType,
                                              }))
                                            }
                                            className={`px-2 py-1 rounded-lg border text-[11px] font-bold ${inputClass}`}
                                          >
                                            <option value="EQUAL">Equal Split</option>
                                            <option value="PERCENTAGE">Percentage (%)</option>
                                            <option value="CUSTOM_AMOUNT">
                                              Custom Amount ({currency})
                                            </option>
                                          </select>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => removeGroup(item.id, group.id)}
                                          className="p-1 opacity-65 hover:opacity-100 hover:text-[#D52073] cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Participant Chips */}
                                    <div className="flex flex-wrap gap-1.5">
                                      {participants.map((p) => {
                                        const selected = group.entries.some(
                                          (e) => e.participantId === p.id
                                        );
                                        return (
                                          <button
                                            key={p.id}
                                            type="button"
                                            onClick={() =>
                                              toggleGroupParticipant(item.id, group, p.id)
                                            }
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                                              selected
                                                ? 'bg-[#31493C] text-[#B3EFB2] border-[#31493C]'
                                                : 'border-[#7A9E7E]/30 opacity-70 hover:opacity-100'
                                            }`}
                                          >
                                            {p.name}
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {/* Percentage or Custom Amount Inputs for Shared Groups */}
                                    {group.mode === 'SHARED' &&
                                      group.splitType !== 'EQUAL' &&
                                      group.entries.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                          {group.entries.map((entry) => {
                                            const pName =
                                              participants.find((p) => p.id === entry.participantId)
                                                ?.name || 'Participant';
                                            return (
                                              <div
                                                key={entry.participantId}
                                                className="flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-lg border border-[#7A9E7E]/25"
                                              >
                                                <span className="truncate font-semibold">
                                                  {pName}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={
                                                      group.splitType === 'PERCENTAGE'
                                                        ? entry.percentage ?? ''
                                                        : entry.customAmount ?? ''
                                                    }
                                                    onChange={(e) => {
                                                      const val = parseFloat(e.target.value) || 0;
                                                      updateGroup(item.id, group.id, (g) => ({
                                                        ...g,
                                                        entries: g.entries.map((en) =>
                                                          en.participantId === entry.participantId
                                                            ? group.splitType === 'PERCENTAGE'
                                                              ? { ...en, percentage: val }
                                                              : { ...en, customAmount: val }
                                                            : en
                                                        ),
                                                      }));
                                                    }}
                                                    className={`w-20 px-2 py-0.5 rounded border text-right text-xs ${inputClass}`}
                                                  />
                                                  <span className="text-[11px] opacity-70">
                                                    {group.splitType === 'PERCENTAGE'
                                                      ? '%'
                                                      : currency}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* STEP 4: VAT, Service Charges, Extra Fees & Discounts */}
              <section className={`p-5 rounded-2xl border space-y-4 ${cardClass}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#31493C] dark:text-[#B3EFB2]">
                      Step 4
                    </span>
                    <h2 className="text-base font-extrabold">
                      VAT, Service Charges, Delivery &amp; Discounts
                    </h2>
                  </div>
                  <Percent className="w-4 h-4 opacity-60" />
                </div>

                {/* VAT Configuration */}
                <div className="p-3.5 rounded-xl border border-[#7A9E7E]/25 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold">VAT / Tax Configuration</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(['EXCLUSIVE', 'INCLUSIVE', 'NONE'] as VatMode[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setVatMode(m)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                            vatMode === m
                              ? 'bg-[#31493C] text-[#B3EFB2] border-[#31493C]'
                              : 'border-[#7A9E7E]/30 opacity-75'
                          }`}
                        >
                          {m === 'EXCLUSIVE'
                            ? 'Add VAT Separately'
                            : m === 'INCLUSIVE'
                            ? 'VAT Already Included'
                            : 'No VAT'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {vatMode !== 'NONE' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-[11px] font-bold block mb-1 opacity-75">
                          Input Type
                        </label>
                        <select
                          value={vatType}
                          onChange={(e) => setVatType(e.target.value as ChargeInputType)}
                          className={`w-full px-2.5 py-1.5 rounded-xl border text-xs ${inputClass}`}
                        >
                          <option value="PERCENT">VAT Percentage (%)</option>
                          <option value="FIXED">Exact Receipt VAT ({currency})</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold block mb-1 opacity-75">
                          {vatType === 'PERCENT' ? 'VAT Rate (%)' : `VAT Amount (${currency})`}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={vatValue || ''}
                          onChange={(e) => setVatValue(parseFloat(e.target.value) || 0)}
                          placeholder={vatType === 'PERCENT' ? 'e.g., 5, 7.5, 15' : '0.00'}
                          className={`w-full px-2.5 py-1.5 rounded-xl border text-xs ${inputClass}`}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold block mb-1 opacity-75">
                          VAT Calculation Basis
                        </label>
                        <select
                          value={discountTiming}
                          onChange={(e) => setDiscountTiming(e.target.value as DiscountTiming)}
                          className={`w-full px-2.5 py-1.5 rounded-xl border text-xs ${inputClass}`}
                        >
                          <option value="BEFORE_VAT">Apply Discount Before VAT</option>
                          <option value="AFTER_VAT">Calculate VAT Before Discount</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Service Charge, Delivery & Discounts */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border border-[#7A9E7E]/25 space-y-2">
                    <span className="text-xs font-extrabold block">Service Charge</span>
                    <div className="flex gap-1.5">
                      <select
                        value={serviceChargeType}
                        onChange={(e) => setServiceChargeType(e.target.value as ChargeInputType)}
                        className={`px-2 py-1.5 rounded-lg border text-xs ${inputClass}`}
                      >
                        <option value="PERCENT">%</option>
                        <option value="FIXED">{currency}</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={serviceChargeValue || ''}
                        onChange={(e) => setServiceChargeValue(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputClass}`}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-[#7A9E7E]/25 space-y-2">
                    <span className="text-xs font-extrabold block">Delivery Charge ({currency})</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={deliveryCharge || ''}
                      onChange={(e) => setDeliveryCharge(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputClass}`}
                    />
                  </div>

                  <div className="p-3 rounded-xl border border-[#7A9E7E]/25 space-y-2">
                    <span className="text-xs font-extrabold block">Discount</span>
                    <div className="flex gap-1.5">
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as ChargeInputType)}
                        className={`px-2 py-1.5 rounded-lg border text-xs ${inputClass}`}
                      >
                        <option value="FIXED">{currency}</option>
                        <option value="PERCENT">%</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={discountValue || ''}
                        onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputClass}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Custom Additional Charges */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Other Custom Charges</span>
                    <button
                      type="button"
                      onClick={addExtraCharge}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-[#7A9E7E]/40 hover:bg-[#7A9E7E]/15 cursor-pointer"
                    >
                      + Add Charge
                    </button>
                  </div>
                  {extraCharges.map((ch) => (
                    <div key={ch.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={ch.label}
                        onChange={(e) =>
                          setExtraCharges((prev) =>
                            prev.map((c) => (c.id === ch.id ? { ...c, label: e.target.value } : c))
                          )
                        }
                        placeholder="Charge label"
                        className={`flex-1 px-2.5 py-1.5 rounded-lg border text-xs ${inputClass}`}
                      />
                      <select
                        value={ch.type}
                        onChange={(e) =>
                          setExtraCharges((prev) =>
                            prev.map((c) =>
                              c.id === ch.id ? { ...c, type: e.target.value as ChargeInputType } : c
                            )
                          )
                        }
                        className={`px-2 py-1.5 rounded-lg border text-xs ${inputClass}`}
                      >
                        <option value="FIXED">{currency}</option>
                        <option value="PERCENT">%</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={ch.value || ''}
                        onChange={(e) =>
                          setExtraCharges((prev) =>
                            prev.map((c) =>
                              c.id === ch.id
                                ? { ...c, value: parseFloat(e.target.value) || 0 }
                                : c
                            )
                          )
                        }
                        className={`w-24 px-2.5 py-1.5 rounded-lg border text-xs ${inputClass}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setExtraCharges((prev) => prev.filter((c) => c.id !== ch.id))
                        }
                        className="p-1.5 opacity-65 hover:text-[#D52073] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* STEP 6: Who Paid & Wallet Integration */}
              <section className={`p-5 rounded-2xl border space-y-4 ${cardClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#31493C] dark:text-[#B3EFB2]">
                      Step 6
                    </span>
                    <h2 className="text-base font-extrabold">Who Paid the Original Bill?</h2>
                  </div>

                  <div className="inline-flex rounded-xl p-1 border border-[#7A9E7E]/30 bg-[#7A9E7E]/10">
                    <button
                      type="button"
                      onClick={() => setPayerMode('SINGLE')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        payerMode === 'SINGLE' ? 'bg-[#31493C] text-[#B3EFB2]' : 'opacity-75'
                      }`}
                    >
                      Paid by One Person
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayerMode('MULTI')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        payerMode === 'MULTI' ? 'bg-[#31493C] text-[#B3EFB2]' : 'opacity-75'
                      }`}
                    >
                      Multiple Contributors
                    </button>
                  </div>
                </div>

                {payerMode === 'SINGLE' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold block mb-1 opacity-75">
                        Payer ({currency}
                        {liveCalc.finalTotal.toFixed(2)})
                      </label>
                      <select
                        value={singlePayerId}
                        onChange={(e) => setSinglePayerId(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-xs font-bold ${inputClass}`}
                      >
                        {participants.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {participants.find((p) => p.id === singlePayerId)?.isMe && (
                      <div>
                        <label className="text-[11px] font-bold block mb-1 opacity-75">
                          Deduct From PocketQ Wallet
                        </label>
                        <select
                          value={
                            participants.find((p) => p.id === singlePayerId)?.walletId || ''
                          }
                          onChange={(e) =>
                            setParticipants((prev) =>
                              prev.map((p) =>
                                p.id === singlePayerId
                                  ? { ...p, walletId: e.target.value || null }
                                  : p
                              )
                            )
                          }
                          className={`w-full px-3 py-2 rounded-xl border text-xs ${inputClass}`}
                        >
                          <option value="">Do not link to a wallet</option>
                          {wallets.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({currency}
                              {w.balance.toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {participants.map((p) => (
                      <div
                        key={p.id}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-xl border border-[#7A9E7E]/25"
                      >
                        <span className="sm:col-span-4 text-xs font-bold">{p.name}</span>
                        <div className="sm:col-span-4">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={p.paidAmount || ''}
                            onChange={(e) => {
                              const amt = parseFloat(e.target.value) || 0;
                              setParticipants((prev) =>
                                prev.map((item) =>
                                  item.id === p.id ? { ...item, paidAmount: amt } : item
                                )
                              );
                            }}
                            placeholder={`Amount paid (${currency})`}
                            className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputClass}`}
                          />
                        </div>
                        <div className="sm:col-span-4">
                          {p.isMe && p.paidAmount > 0 && (
                            <select
                              value={p.walletId || ''}
                              onChange={(e) =>
                                setParticipants((prev) =>
                                  prev.map((item) =>
                                    item.id === p.id
                                      ? { ...item, walletId: e.target.value || null }
                                      : item
                                  )
                                )
                              }
                              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputClass}`}
                            >
                              <option value="">No wallet deduction</option>
                              {wallets.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.name} ({currency}
                                  {w.balance.toLocaleString()})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* RIGHT COLUMN: Step 5 Live Bill Summary & Confirm CTA */}
            <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-20">
              <div className={`p-5 rounded-2xl border space-y-4 ${cardClass}`}>
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#31493C] dark:text-[#B3EFB2]">
                    Step 5 • Live Summary
                  </span>
                  <h2 className="text-base font-extrabold">Bill Breakdown &amp; Shares</h2>
                </div>

                {/* Totals Table */}
                <div className="space-y-1.5 text-xs border-b border-[#7A9E7E]/20 pb-3">
                  <div className="flex justify-between">
                    <span className="opacity-75">Items Subtotal</span>
                    <span className="font-bold">
                      {currency}
                      {liveCalc.itemsSubtotal.toFixed(2)}
                    </span>
                  </div>
                  {liveCalc.discountAmount > 0 && (
                    <div className="flex justify-between text-[#31493C] dark:text-[#B3EFB2]">
                      <span>Discount</span>
                      <span className="font-bold">
                        -{currency}
                        {liveCalc.discountAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="opacity-75">
                      VAT {vatMode === 'INCLUSIVE' ? '(Included)' : ''}
                    </span>
                    <span className="font-bold">
                      {vatMode === 'INCLUSIVE' ? '' : '+'}
                      {currency}
                      {liveCalc.vatAmount.toFixed(2)}
                    </span>
                  </div>
                  {liveCalc.serviceChargeAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="opacity-75">Service Charge</span>
                      <span className="font-bold">
                        +{currency}
                        {liveCalc.serviceChargeAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {liveCalc.otherChargesTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="opacity-75">Delivery &amp; Other Charges</span>
                      <span className="font-bold">
                        +{currency}
                        {liveCalc.otherChargesTotal.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-extrabold pt-2 border-t border-[#7A9E7E]/20">
                    <span>Final Bill Total</span>
                    <span>
                      {currency}
                      {liveCalc.finalTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Individual Participant Breakdowns */}
                <div className="space-y-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-65 block">
                    Individual Shares ({participants.length})
                  </span>
                  {liveCalc.participantBreakdowns.map((b) => (
                    <div
                      key={b.participantId}
                      className="p-3 rounded-xl border border-[#7A9E7E]/25 bg-[#7A9E7E]/5 space-y-1 text-xs"
                    >
                      <div className="flex justify-between items-center font-extrabold">
                        <span>{b.name}</span>
                        <span className="text-sm text-[#31493C] dark:text-[#B3EFB2]">
                          {currency}
                          {b.finalOwed.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[11px] opacity-75 flex flex-wrap gap-x-3 gap-y-0.5">
                        {splitMode === 'ITEMIZED' && (
                          <>
                            <span>Own: {currency}{b.individualItemAmount.toFixed(2)}</span>
                            <span>Shared: {currency}{b.sharedItemAmount.toFixed(2)}</span>
                          </>
                        )}
                        <span>VAT: {currency}{b.vatShare.toFixed(2)}</span>
                        {b.chargesShare > 0 && (
                          <span>Fees: {currency}{b.chargesShare.toFixed(2)}</span>
                        )}
                        {b.discountShare > 0 && (
                          <span>Disc: -{currency}{b.discountShare.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Netted Settlement Preview */}
                {liveCalc.nettedTransfers.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-[#7A9E7E]/20">
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-65 block">
                      Who Pays Whom
                    </span>
                    {liveCalc.nettedTransfers.map((tr, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#31493C]/10"
                      >
                        <span className="font-semibold truncate">
                          {tr.fromName} <ArrowRight className="w-3 h-3 inline mx-0.5" /> {tr.toName}
                        </span>
                        <span className="font-extrabold">
                          {currency}
                          {tr.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Validation Checklist */}
                {liveCalc.validationErrors.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs space-y-1">
                    <span className="font-extrabold block text-amber-700 dark:text-amber-300">
                      Before Confirming:
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      {liveCalc.validationErrors.slice(0, 4).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!liveCalc.isValid || submitting}
                  onClick={handleConfirmBill}
                  className="w-full py-3 px-4 rounded-xl text-xs font-extrabold bg-[#31493C] text-[#B3EFB2] hover:opacity-95 disabled:opacity-40 transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  {submitting ? 'Confirming & Syncing...' : 'Confirm Bill & Create Settlements'}
                </button>
              </div>
            </aside>
          </div>
        ) : (
          /* STEP 7: Saved Bills & Settlement Management */
          <section className="space-y-4">
            {loading ? (
              <div className={`p-8 rounded-2xl border text-center text-xs ${cardClass}`}>
                Loading bill splits...
              </div>
            ) : savedBills.length === 0 ? (
              <div className={`p-8 rounded-2xl border text-center space-y-3 ${cardClass}`}>
                <p className="text-sm font-bold">No split bills recorded yet</p>
                <p className="text-xs opacity-70">
                  Create your first itemized or equal bill split to calculate shares and track repayments.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('NEW')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] cursor-pointer"
                >
                  + Create a Bill Split
                </button>
              </div>
            ) : (
              savedBills.map((bill) => (
                <div key={bill.id} className={`p-5 rounded-2xl border space-y-4 ${cardClass}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#7A9E7E]/20 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold">{bill.title}</h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            bill.status === 'SETTLED'
                              ? 'bg-[#B3EFB2]/30 text-[#31493C] dark:text-[#B3EFB2]'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {bill.status}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-[#7A9E7E]/30">
                          {bill.splitMode}
                        </span>
                      </div>
                      <p className="text-xs opacity-70 mt-0.5">
                        {formatDateDDMMYYYY(bill.date)} • {bill.participants.length} participants
                        {bill.notes ? ` • ${bill.notes}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[11px] opacity-65 block">Final Total</span>
                        <span className="text-base font-extrabold">
                          {currency}
                          {bill.totalAmount.toFixed(2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteBill(bill.id)}
                        aria-label="Delete bill"
                        className="p-2 rounded-xl border border-[#D52073]/30 text-[#D52073] hover:bg-[#D52073]/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Participant Shares Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {bill.participants.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl border border-[#7A9E7E]/20 text-xs space-y-1"
                      >
                        <div className="flex justify-between font-bold">
                          <span>{p.name}</span>
                          <span>
                            {currency}
                            {p.finalOwed.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[11px] opacity-70">
                          Paid: {currency}
                          {p.paidAmount.toFixed(2)} • VAT: {currency}
                          {p.vatShare.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Settlements List */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-65 block">
                      Settlement Transfers
                    </span>
                    {bill.settlements.length === 0 ? (
                      <p className="text-xs opacity-70">No transfers needed — everyone paid their exact share.</p>
                    ) : (
                      bill.settlements.map((s) => {
                        const remaining = Math.max(
                          0,
                          Math.round((s.amount - s.paidAmount) * 100) / 100
                        );
                        return (
                          <div
                            key={s.id}
                            className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-[#7A9E7E]/25 bg-[#7A9E7E]/5 text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="font-bold flex items-center gap-1.5">
                                <span>{s.fromParticipant.name}</span>
                                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                                <span>{s.toParticipant.name}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    s.status === 'PAID'
                                      ? 'bg-[#B3EFB2]/30 text-[#31493C] dark:text-[#B3EFB2]'
                                      : s.status === 'PARTIAL'
                                      ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300'
                                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                  }`}
                                >
                                  {s.status}
                                </span>
                              </div>
                              <div className="text-[11px] opacity-70">
                                Total: {currency}
                                {s.amount.toFixed(2)} • Paid: {currency}
                                {s.paidAmount.toFixed(2)} • Remaining: {currency}
                                {remaining.toFixed(2)}
                                {s.paidDate ? ` • Last payment: ${formatDateDDMMYYYY(s.paidDate)}` : ''}
                                {s.note ? ` • "${s.note}"` : ''}
                              </div>
                            </div>

                            {s.status !== 'PAID' && (
                              <button
                                type="button"
                                onClick={() => openSettlementModal(bill, s)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#31493C] text-[#B3EFB2] hover:opacity-90 cursor-pointer flex items-center gap-1.5"
                              >
                                <Wallet className="w-3.5 h-3.5" /> Record Payment
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </main>

      {/* Partial / Full Settlement Modal */}
      {settlingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleRecordSettlement}
            className={`w-full max-w-md p-5 rounded-2xl border shadow-2xl space-y-4 ${cardClass}`}
          >
            <div>
              <h3 className="text-base font-extrabold">Record Settlement Payment</h3>
              <p className="text-xs opacity-75 mt-0.5">
                {settlingTarget.settlement.fromParticipant.name} →{' '}
                {settlingTarget.settlement.toParticipant.name} ({settlingTarget.billTitle})
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold block mb-1 opacity-75">
                  Payment Amount ({currency}) — supports partial payments
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-bold ${inputClass}`}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold block mb-1 opacity-75">Payment Date</label>
                <input
                  type="date"
                  required
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${inputClass}`}
                />
              </div>

              {(settlingTarget.settlement.toParticipant.isMe ||
                settlingTarget.settlement.fromParticipant.isMe) && (
                <div>
                  <label className="text-[11px] font-bold block mb-1 opacity-75">
                    {settlingTarget.settlement.toParticipant.isMe
                      ? 'Deposit Repayment Into Wallet (Not counted as Income)'
                      : 'Pay From Wallet'}
                  </label>
                  <select
                    value={settleWalletId}
                    onChange={(e) => setSettleWalletId(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${inputClass}`}
                  >
                    <option value="">Do not update a wallet</option>
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({currency}
                        {w.balance.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold block mb-1 opacity-75">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  placeholder="e.g., Paid via bKash"
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${inputClass}`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSettlingTarget(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-[#7A9E7E]/30 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={settlingBusy}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#31493C] text-[#B3EFB2] cursor-pointer"
              >
                {settlingBusy ? 'Saving...' : 'Confirm Payment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
