/**
 * @file lib/bill-split.ts
 * @description Deterministic Bill Splitting calculation, validation, and minimum-transfer settlement netting engine.
 * All monetary allocations execute in integer minor units (paisa/cents = amount * 100) and reconcile rounding
 * via Hamilton's Largest Remainder method so participant shares always sum to the exact bill total.
 */

export type SplitMode = 'ITEMIZED' | 'EQUAL';
export type VatMode = 'EXCLUSIVE' | 'INCLUSIVE' | 'NONE';
export type ChargeInputType = 'PERCENT' | 'FIXED';
export type DiscountTiming = 'BEFORE_VAT' | 'AFTER_VAT';
export type GroupSplitType = 'EQUAL' | 'PERCENTAGE' | 'CUSTOM_AMOUNT';

export interface ParticipantDraft {
  id: string;
  name: string;
  isMe: boolean;
  paidAmount: number;
  walletId?: string | null;
}

export interface AssignmentEntryDraft {
  participantId: string;
  percentage?: number;
  customAmount?: number;
}

export interface ItemAllocationGroupDraft {
  id: string;
  mode: 'SINGLE' | 'SHARED';
  quantity: number; // Portion of the item's quantity covered by this group (supports fractional e.g. 0.5)
  splitType: GroupSplitType;
  entries: AssignmentEntryDraft[];
}

export interface BillItemDraft {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  groups: ItemAllocationGroupDraft[];
}

export interface ExtraChargeDraft {
  id: string;
  label: string;
  type: ChargeInputType;
  value: number;
}

export interface BillCalculationInput {
  splitMode: SplitMode;
  participants: ParticipantDraft[];
  items: BillItemDraft[];
  vatMode: VatMode;
  vatType: ChargeInputType;
  vatValue: number;
  discountTiming: DiscountTiming;
  discountType: ChargeInputType;
  discountValue: number;
  serviceChargeType: ChargeInputType;
  serviceChargeValue: number;
  deliveryCharge: number;
  extraCharges: ExtraChargeDraft[];
}

export interface ParticipantBreakdown {
  participantId: string;
  name: string;
  isMe: boolean;
  paidAmount: number;
  walletId?: string | null;
  individualItemAmount: number;
  sharedItemAmount: number;
  itemSubtotal: number;
  vatShare: number;
  serviceChargeShare: number;
  otherChargesShare: number;
  chargesShare: number;
  discountShare: number;
  finalOwed: number;
  netBalance: number; // positive = owed money (creditor), negative = owes money (debtor)
}

export interface ItemValidationStatus {
  itemId: string;
  name: string;
  totalQuantity: number;
  assignedQuantity: number;
  remainingQuantity: number;
  subtotal: number;
  assignedAmount: number;
  isFullyAssigned: boolean;
  isOverAssigned: boolean;
  errors: string[];
}

export interface NettedTransfer {
  fromParticipantId: string;
  fromName: string;
  toParticipantId: string;
  toName: string;
  amount: number;
}

export interface BillCalculationResult {
  itemsSubtotal: number;
  discountAmount: number;
  vatAmount: number;
  serviceChargeAmount: number;
  deliveryChargeAmount: number;
  customChargesTotal: number;
  otherChargesTotal: number;
  finalTotal: number;
  totalPaidByParticipants: number;
  unallocatedPaymentDiff: number;
  participantBreakdowns: ParticipantBreakdown[];
  itemStatuses: ItemValidationStatus[];
  nettedTransfers: NettedTransfer[];
  validationErrors: string[];
  isValid: boolean;
}

const toMinor = (val: number): number => Math.round((Number.isFinite(val) ? val : 0) * 100);
const fromMinor = (minor: number): number => Math.round(minor) / 100;

/**
 * Distributes `totalMinor` proportionally across `weights` using Hamilton's Largest Remainder method
 * so the returned integer array always sums to `totalMinor`.
 */
export function distributeMinorUnits(totalMinor: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (totalMinor === 0) return new Array(n).fill(0);

  const safeWeights = weights.map((w) => Math.max(0, Number.isFinite(w) ? w : 0));
  const weightSum = safeWeights.reduce((acc, w) => acc + w, 0);

  if (weightSum <= 0) {
    // Fallback to equal distribution when all weights are zero
    const equalWeights = new Array(n).fill(1);
    return distributeMinorUnits(totalMinor, equalWeights);
  }

  const sign = totalMinor < 0 ? -1 : 1;
  const absTotal = Math.abs(totalMinor);

  const exact = safeWeights.map((w) => (absTotal * w) / weightSum);
  const floors = exact.map((e) => Math.floor(e));
  let remainder = absTotal - floors.reduce((a, b) => a + b, 0);

  const indexedRemainders = exact
    .map((e, idx) => ({ idx, rem: e - floors[idx] }))
    .sort((a, b) => b.rem - a.rem);

  for (let i = 0; i < remainder; i++) {
    floors[indexedRemainders[i % n].idx] += 1;
  }

  return floors.map((v) => v * sign);
}

export function calculateBillSplit(input: BillCalculationInput): BillCalculationResult {
  const validationErrors: string[] = [];
  const participants = input.participants;

  if (participants.length === 0) {
    validationErrors.push('Add at least one participant.');
  }

  // 1. Item subtotals
  const itemMinorSubtotals = new Map<string, number>();
  let itemsSubtotalMinor = 0;

  for (const item of input.items) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    const subMinor = toMinor(qty * price);
    itemMinorSubtotals.set(item.id, subMinor);
    itemsSubtotalMinor += subMinor;
  }

  if (input.items.length === 0 || itemsSubtotalMinor <= 0) {
    validationErrors.push('Add at least one bill item with a positive price.');
  }

  // 2. Discount, VAT, Service Charge & Additional Charges
  // Determine pre-discount subtotal vs post-discount basis
  const rawDiscountMinor =
    input.discountType === 'PERCENT'
      ? Math.round((itemsSubtotalMinor * Math.max(0, input.discountValue || 0)) / 100)
      : toMinor(Math.max(0, input.discountValue || 0));

  const discountMinor = Math.min(itemsSubtotalMinor, rawDiscountMinor);
  const discountedSubtotalMinor = Math.max(0, itemsSubtotalMinor - discountMinor);

  const vatBasisMinor =
    input.discountTiming === 'BEFORE_VAT' ? discountedSubtotalMinor : itemsSubtotalMinor;

  let vatMinor = 0;
  if (input.vatMode === 'EXCLUSIVE') {
    vatMinor =
      input.vatType === 'PERCENT'
        ? Math.round((vatBasisMinor * Math.max(0, input.vatValue || 0)) / 100)
        : toMinor(Math.max(0, input.vatValue || 0));
  } else if (input.vatMode === 'INCLUSIVE') {
    if (input.vatType === 'PERCENT') {
      const rate = Math.max(0, input.vatValue || 0) / 100;
      vatMinor = rate > 0 ? Math.round(vatBasisMinor - vatBasisMinor / (1 + rate)) : 0;
    } else {
      vatMinor = Math.min(vatBasisMinor, toMinor(Math.max(0, input.vatValue || 0)));
    }
  }

  const serviceChargeMinor =
    input.serviceChargeType === 'PERCENT'
      ? Math.round((discountedSubtotalMinor * Math.max(0, input.serviceChargeValue || 0)) / 100)
      : toMinor(Math.max(0, input.serviceChargeValue || 0));

  const deliveryMinor = toMinor(Math.max(0, input.deliveryCharge || 0));

  let customChargesMinor = 0;
  for (const ch of input.extraCharges || []) {
    const chMinor =
      ch.type === 'PERCENT'
        ? Math.round((discountedSubtotalMinor * Math.max(0, ch.value || 0)) / 100)
        : toMinor(Math.max(0, ch.value || 0));
    customChargesMinor += chMinor;
  }

  const otherChargesMinor = deliveryMinor + customChargesMinor;

  // If VAT is INCLUSIVE, it is already embedded in itemsSubtotalMinor (do NOT add twice)
  const additiveVatMinor = input.vatMode === 'EXCLUSIVE' ? vatMinor : 0;
  const finalTotalMinor = Math.max(
    0,
    itemsSubtotalMinor - discountMinor + additiveVatMinor + serviceChargeMinor + otherChargesMinor
  );

  // 3. Per-item assignments & validation
  const individualMinorByParticipant = new Map<string, number>();
  const sharedMinorByParticipant = new Map<string, number>();
  participants.forEach((p) => {
    individualMinorByParticipant.set(p.id, 0);
    sharedMinorByParticipant.set(p.id, 0);
  });

  const itemStatuses: ItemValidationStatus[] = [];

  for (const item of input.items) {
    const itemSubMinor = itemMinorSubtotals.get(item.id) || 0;
    const totalQty = Math.max(0, Number(item.quantity) || 0);
    const errors: string[] = [];

    let assignedQty = 0;
    let assignedMinorTotal = 0;

    if (input.splitMode === 'ITEMIZED') {
      for (const group of item.groups || []) {
        const groupQty = Math.max(0, Number(group.quantity) || 0);
        assignedQty += groupQty;

        if (group.entries.length === 0) {
          errors.push('An assignment group has no selected participants.');
          continue;
        }

        // Exact minor cost of this group's quantity slice
        const groupMinor =
          totalQty > 0 ? Math.round((itemSubMinor * groupQty) / totalQty) : 0;

        if (group.mode === 'SINGLE' || group.entries.length === 1) {
          const targetId = group.entries[0].participantId;
          if (!individualMinorByParticipant.has(targetId)) {
            errors.push('Assigned participant no longer exists.');
            continue;
          }
          individualMinorByParticipant.set(
            targetId,
            (individualMinorByParticipant.get(targetId) || 0) + groupMinor
          );
          assignedMinorTotal += groupMinor;
        } else {
          // Shared among multiple participants
          if (group.splitType === 'EQUAL') {
            const shares = distributeMinorUnits(
              groupMinor,
              group.entries.map(() => 1)
            );
            group.entries.forEach((entry, idx) => {
              sharedMinorByParticipant.set(
                entry.participantId,
                (sharedMinorByParticipant.get(entry.participantId) || 0) + shares[idx]
              );
            });
            assignedMinorTotal += groupMinor;
          } else if (group.splitType === 'PERCENTAGE') {
            const pctSum = group.entries.reduce((acc, e) => acc + (Number(e.percentage) || 0), 0);
            if (Math.abs(pctSum - 100) > 0.05) {
              errors.push(
                `"${item.name || 'Item'}" percentage split totals ${pctSum.toFixed(1)}% (must equal 100%).`
              );
            }
            const shares = distributeMinorUnits(
              groupMinor,
              group.entries.map((e) => Math.max(0, Number(e.percentage) || 0))
            );
            group.entries.forEach((entry, idx) => {
              sharedMinorByParticipant.set(
                entry.participantId,
                (sharedMinorByParticipant.get(entry.participantId) || 0) + shares[idx]
              );
            });
            assignedMinorTotal += groupMinor;
          } else if (group.splitType === 'CUSTOM_AMOUNT') {
            const customMinorList = group.entries.map((e) =>
              toMinor(Math.max(0, Number(e.customAmount) || 0))
            );
            const customSumMinor = customMinorList.reduce((a, b) => a + b, 0);
            if (Math.abs(customSumMinor - groupMinor) > 1) {
              errors.push(
                `"${item.name || 'Item'}" custom amounts (${fromMinor(customSumMinor).toFixed(
                  2
                )}) must equal portion cost (${fromMinor(groupMinor).toFixed(2)}).`
              );
            }
            group.entries.forEach((entry, idx) => {
              sharedMinorByParticipant.set(
                entry.participantId,
                (sharedMinorByParticipant.get(entry.participantId) || 0) + customMinorList[idx]
              );
            });
            assignedMinorTotal += customSumMinor;
          }
        }
      }

      const remainingQty = Math.round((totalQty - assignedQty) * 10000) / 10000;
      const isOverAssigned = remainingQty < -0.0001;
      const isFullyAssigned = Math.abs(remainingQty) <= 0.0001 && totalQty > 0;

      if (isOverAssigned) {
        errors.push(
          `"${item.name || 'Item'}" assigned quantity (${assignedQty}) exceeds item quantity (${totalQty}).`
        );
      } else if (!isFullyAssigned && totalQty > 0) {
        errors.push(
          `"${item.name || 'Item'}" has ${remainingQty} unassigned quantity remaining.`
        );
      }

      errors.forEach((e) => validationErrors.push(e));

      itemStatuses.push({
        itemId: item.id,
        name: item.name,
        totalQuantity: totalQty,
        assignedQuantity: assignedQty,
        remainingQuantity: Math.max(0, remainingQty),
        subtotal: fromMinor(itemSubMinor),
        assignedAmount: fromMinor(assignedMinorTotal),
        isFullyAssigned,
        isOverAssigned,
        errors,
      });
    } else {
      // EQUAL split mode treats all items as assigned across everyone
      itemStatuses.push({
        itemId: item.id,
        name: item.name,
        totalQuantity: totalQty,
        assignedQuantity: totalQty,
        remainingQuantity: 0,
        subtotal: fromMinor(itemSubMinor),
        assignedAmount: fromMinor(itemSubMinor),
        isFullyAssigned: true,
        isOverAssigned: false,
        errors: [],
      });
    }
  }

  // 4. Participant final shares
  let participantBreakdowns: ParticipantBreakdown[] = [];

  if (input.splitMode === 'EQUAL') {
    const equalWeights = participants.map(() => 1);
    const itemShares = distributeMinorUnits(itemsSubtotalMinor, equalWeights);
    const discountShares = distributeMinorUnits(discountMinor, equalWeights);
    const vatShares = distributeMinorUnits(vatMinor, equalWeights);
    const serviceShares = distributeMinorUnits(serviceChargeMinor, equalWeights);
    const otherShares = distributeMinorUnits(otherChargesMinor, equalWeights);
    const finalShares = distributeMinorUnits(finalTotalMinor, equalWeights);

    participantBreakdowns = participants.map((p, idx) => {
      const paidMinor = toMinor(Math.max(0, Number(p.paidAmount) || 0));
      const finalMinor = finalShares[idx] || 0;
      return {
        participantId: p.id,
        name: p.name,
        isMe: p.isMe,
        paidAmount: fromMinor(paidMinor),
        walletId: p.walletId,
        individualItemAmount: 0,
        sharedItemAmount: fromMinor(itemShares[idx] || 0),
        itemSubtotal: fromMinor(itemShares[idx] || 0),
        vatShare: fromMinor(vatShares[idx] || 0),
        serviceChargeShare: fromMinor(serviceShares[idx] || 0),
        otherChargesShare: fromMinor(otherShares[idx] || 0),
        chargesShare: fromMinor((serviceShares[idx] || 0) + (otherShares[idx] || 0)),
        discountShare: fromMinor(discountShares[idx] || 0),
        finalOwed: fromMinor(finalMinor),
        netBalance: fromMinor(paidMinor - finalMinor),
      };
    });
  } else {
    const rawItemMinors = participants.map(
      (p) =>
        (individualMinorByParticipant.get(p.id) || 0) +
        (sharedMinorByParticipant.get(p.id) || 0)
    );

    const discountShares = distributeMinorUnits(discountMinor, rawItemMinors);
    const vatShares = distributeMinorUnits(vatMinor, rawItemMinors);
    const serviceShares = distributeMinorUnits(serviceChargeMinor, rawItemMinors);
    const otherShares = distributeMinorUnits(otherChargesMinor, rawItemMinors);

    // Compute exact final share per participant and reconcile any 1-paisa rounding delta
    const rawFinalMinors = participants.map((_, idx) => {
      const addVat = input.vatMode === 'EXCLUSIVE' ? vatShares[idx] : 0;
      return Math.max(
        0,
        rawItemMinors[idx] - discountShares[idx] + addVat + serviceShares[idx] + otherShares[idx]
      );
    });

    const rawFinalSum = rawFinalMinors.reduce((a, b) => a + b, 0);
    const delta = finalTotalMinor - rawFinalSum;
    if (delta !== 0 && rawFinalMinors.length > 0) {
      // Apply any 1-unit rounding reconciliation to the participant with the largest subtotal
      let maxIdx = 0;
      for (let i = 1; i < rawItemMinors.length; i++) {
        if (rawItemMinors[i] > rawItemMinors[maxIdx]) maxIdx = i;
      }
      rawFinalMinors[maxIdx] = Math.max(0, rawFinalMinors[maxIdx] + delta);
    }

    participantBreakdowns = participants.map((p, idx) => {
      const indivMinor = individualMinorByParticipant.get(p.id) || 0;
      const sharedMinor = sharedMinorByParticipant.get(p.id) || 0;
      const paidMinor = toMinor(Math.max(0, Number(p.paidAmount) || 0));
      const finalMinor = rawFinalMinors[idx] || 0;

      return {
        participantId: p.id,
        name: p.name,
        isMe: p.isMe,
        paidAmount: fromMinor(paidMinor),
        walletId: p.walletId,
        individualItemAmount: fromMinor(indivMinor),
        sharedItemAmount: fromMinor(sharedMinor),
        itemSubtotal: fromMinor(indivMinor + sharedMinor),
        vatShare: fromMinor(vatShares[idx] || 0),
        serviceChargeShare: fromMinor(serviceShares[idx] || 0),
        otherChargesShare: fromMinor(otherShares[idx] || 0),
        chargesShare: fromMinor((serviceShares[idx] || 0) + (otherShares[idx] || 0)),
        discountShare: fromMinor(discountShares[idx] || 0),
        finalOwed: fromMinor(finalMinor),
        netBalance: fromMinor(paidMinor - finalMinor),
      };
    });
  }

  // 5. Payer validation & Minimum-Transfer Settlement Netting
  const totalPaidMinor = participants.reduce(
    (acc, p) => acc + toMinor(Math.max(0, Number(p.paidAmount) || 0)),
    0
  );
  const paymentDiffMinor = finalTotalMinor - totalPaidMinor;

  if (finalTotalMinor > 0 && Math.abs(paymentDiffMinor) > 1) {
    validationErrors.push(
      `Total paid (${fromMinor(totalPaidMinor).toFixed(2)}) must equal final bill total (${fromMinor(
        finalTotalMinor
      ).toFixed(2)}).`
    );
  }

  // Greedy min-cash-flow settlement algorithm
  const debtors = participantBreakdowns
    .map((b) => ({
      id: b.participantId,
      name: b.name,
      amount: toMinor(-b.netBalance),
    }))
    .filter((d) => d.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const creditors = participantBreakdowns
    .map((b) => ({
      id: b.participantId,
      name: b.name,
      amount: toMinor(b.netBalance),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const nettedTransfers: NettedTransfer[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const transferMinor = Math.min(debtor.amount, creditor.amount);

    if (transferMinor > 0) {
      nettedTransfers.push({
        fromParticipantId: debtor.id,
        fromName: debtor.name,
        toParticipantId: creditor.id,
        toName: creditor.name,
        amount: fromMinor(transferMinor),
      });
    }

    debtor.amount -= transferMinor;
    creditor.amount -= transferMinor;

    if (debtor.amount <= 0) dIdx++;
    if (creditor.amount <= 0) cIdx++;
  }

  return {
    itemsSubtotal: fromMinor(itemsSubtotalMinor),
    discountAmount: fromMinor(discountMinor),
    vatAmount: fromMinor(vatMinor),
    serviceChargeAmount: fromMinor(serviceChargeMinor),
    deliveryChargeAmount: fromMinor(deliveryMinor),
    customChargesTotal: fromMinor(customChargesMinor),
    otherChargesTotal: fromMinor(otherChargesMinor),
    finalTotal: fromMinor(finalTotalMinor),
    totalPaidByParticipants: fromMinor(totalPaidMinor),
    unallocatedPaymentDiff: fromMinor(paymentDiffMinor),
    participantBreakdowns,
    itemStatuses,
    nettedTransfers,
    validationErrors,
    isValid: validationErrors.length === 0,
  };
}
