/**
 * @file app/api/bill-splits/route.ts
 * @description REST API for listing and creating itemized or equal Bill Splits with wallet and ledger integration.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/auth';
import {
  calculateBillSplit,
  BillCalculationInput,
  ParticipantDraft,
  BillItemDraft,
  ExtraChargeDraft,
} from '@/lib/bill-split';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.userId;

    const [settings, user, wallets, billSplits] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      }),
      prisma.wallet.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.billSplit.findMany({
        where: { userId },
        include: {
          participants: true,
          items: {
            include: {
              assignments: true,
            },
          },
          extraCharges: true,
          settlements: {
            include: {
              fromParticipant: { select: { id: true, name: true, isMe: true } },
              toParticipant: { select: { id: true, name: true, isMe: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { date: 'desc' },
      }),
    ]);

    return NextResponse.json({
      user,
      currencySymbol: settings?.currencySymbol || '৳',
      wallets,
      billSplits,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load bill splits';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.userId;
    const body = await req.json();

    const title = String(body.title || '').trim() || 'Shared Bill';
    const notes = body.notes ? String(body.notes).trim() : null;
    const billDate = body.date ? new Date(body.date) : new Date();

    const participants: ParticipantDraft[] = Array.isArray(body.participants)
      ? body.participants
      : [];
    const items: BillItemDraft[] = Array.isArray(body.items) ? body.items : [];
    const extraCharges: ExtraChargeDraft[] = Array.isArray(body.extraCharges)
      ? body.extraCharges
      : [];

    const calcInput: BillCalculationInput = {
      splitMode: body.splitMode === 'EQUAL' ? 'EQUAL' : 'ITEMIZED',
      participants,
      items,
      vatMode: ['EXCLUSIVE', 'INCLUSIVE', 'NONE'].includes(body.vatMode)
        ? body.vatMode
        : 'EXCLUSIVE',
      vatType: body.vatType === 'FIXED' ? 'FIXED' : 'PERCENT',
      vatValue: Number(body.vatValue) || 0,
      discountTiming: body.discountTiming === 'AFTER_VAT' ? 'AFTER_VAT' : 'BEFORE_VAT',
      discountType: body.discountType === 'PERCENT' ? 'PERCENT' : 'FIXED',
      discountValue: Number(body.discountValue) || 0,
      serviceChargeType: body.serviceChargeType === 'FIXED' ? 'FIXED' : 'PERCENT',
      serviceChargeValue: Number(body.serviceChargeValue) || 0,
      deliveryCharge: Number(body.deliveryCharge) || 0,
      extraCharges,
    };

    const result = calculateBillSplit(calcInput);
    if (!result.isValid) {
      return NextResponse.json(
        { error: result.validationErrors[0] || 'Invalid bill split configuration', details: result.validationErrors },
        { status: 400 }
      );
    }

    const meParticipant = participants.find((p) => p.isMe);
    const paidByMe = (meParticipant?.paidAmount || 0) > 0;
    const payerWalletId = meParticipant?.walletId || null;

    if (paidByMe && payerWalletId) {
      const walletExists = await prisma.wallet.findFirst({
        where: { id: payerWalletId, userId },
      });
      if (!walletExists) {
        return NextResponse.json({ error: 'Selected payment wallet not found' }, { status: 404 });
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const bill = await tx.billSplit.create({
        data: {
          userId,
          title,
          notes,
          subtotal: result.itemsSubtotal,
          vatMode: calcInput.vatMode,
          vatType: calcInput.vatType,
          vatValue: calcInput.vatValue,
          vatAmount: result.vatAmount,
          discountTiming: calcInput.discountTiming,
          discountType: calcInput.discountType,
          discountValue: calcInput.discountValue,
          discountAmount: result.discountAmount,
          serviceChargeType: calcInput.serviceChargeType,
          serviceChargeValue: calcInput.serviceChargeValue,
          serviceChargeAmt: result.serviceChargeAmount,
          deliveryCharge: result.deliveryChargeAmount,
          otherChargesTotal: result.otherChargesTotal,
          totalAmount: result.finalTotal,
          splitMode: calcInput.splitMode,
          status: result.nettedTransfers.length === 0 ? 'SETTLED' : 'CONFIRMED',
          paidByMe,
          payerWalletId,
          date: billDate,
        },
      });

      // Map client draft participant IDs -> DB participant IDs
      const participantIdMap = new Map<string, string>();
      for (const bd of result.participantBreakdowns) {
        const dbParticipant = await tx.splitParticipant.create({
          data: {
            billSplitId: bill.id,
            name: bd.name,
            isMe: bd.isMe,
            paidAmount: bd.paidAmount,
            walletId: bd.walletId || null,
            individualTotal: bd.individualItemAmount,
            sharedTotal: bd.sharedItemAmount,
            itemTotal: bd.itemSubtotal,
            vatShare: bd.vatShare,
            chargesShare: bd.chargesShare,
            discountShare: bd.discountShare,
            finalOwed: bd.finalOwed,
            isSettled: Math.abs(bd.netBalance) < 0.01,
          },
        });
        participantIdMap.set(bd.participantId, dbParticipant.id);
      }

      // Persist items and assignments
      for (const item of items) {
        const itemSub = Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) * 100) / 100;
        const dbItem = await tx.billItem.create({
          data: {
            billSplitId: bill.id,
            name: item.name.trim() || 'Item',
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice) || 0,
            subtotal: itemSub,
          },
        });

        if (calcInput.splitMode === 'ITEMIZED') {
          for (const group of item.groups || []) {
            const groupTotal = Math.round(
              ((itemSub * (Number(group.quantity) || 0)) / Math.max(0.0001, Number(item.quantity) || 1)) * 100
            ) / 100;

            for (const entry of group.entries) {
              const dbParticipantId = participantIdMap.get(entry.participantId);
              if (!dbParticipantId) continue;

              let allocated = 0;
              if (group.mode === 'SINGLE' || group.entries.length === 1) {
                allocated = groupTotal;
              } else if (group.splitType === 'EQUAL') {
                allocated = Math.round((groupTotal / group.entries.length) * 100) / 100;
              } else if (group.splitType === 'PERCENTAGE') {
                allocated = Math.round(((groupTotal * (Number(entry.percentage) || 0)) / 100) * 100) / 100;
              } else {
                allocated = Number(entry.customAmount) || 0;
              }

              await tx.billItemAssignment.create({
                data: {
                  billItemId: dbItem.id,
                  participantId: dbParticipantId,
                  assignmentGroup: group.id,
                  splitType: group.mode === 'SINGLE' ? 'SINGLE' : group.splitType,
                  quantity: Number(group.quantity) || 1,
                  percentage: group.splitType === 'PERCENTAGE' ? Number(entry.percentage) || 0 : null,
                  allocatedAmount: allocated,
                },
              });
            }
          }
        }
      }

      // Persist extra charges
      for (const ch of extraCharges) {
        const chAmt =
          ch.type === 'PERCENT'
            ? Math.round(((result.itemsSubtotal - result.discountAmount) * (Number(ch.value) || 0)) / 100 * 100) / 100
            : Number(ch.value) || 0;
        if (chAmt > 0) {
          await tx.billExtraCharge.create({
            data: {
              billSplitId: bill.id,
              label: ch.label.trim() || 'Additional Charge',
              type: ch.type,
              value: Number(ch.value) || 0,
              amount: chAmt,
            },
          });
        }
      }

      // Persist netted settlements
      for (const tr of result.nettedTransfers) {
        const fromId = participantIdMap.get(tr.fromParticipantId);
        const toId = participantIdMap.get(tr.toParticipantId);
        if (!fromId || !toId) continue;

        await tx.billSettlement.create({
          data: {
            billSplitId: bill.id,
            fromParticipantId: fromId,
            toParticipantId: toId,
            amount: tr.amount,
            paidAmount: 0,
            status: 'PENDING',
          },
        });
      }

      // Main Finance Integration:
      // If the logged-in user paid out of pocket from a selected wallet:
      // 1) Decrement the wallet balance by the exact cash paid out.
      // 2) Record an EXPENSE transaction for ONLY the user's own share (avoiding inflated expense stats).
      // 3) Record the fronted receivable portion as type 'SETTLEMENT_OUT' (tracked separately from EXPENSE).
      if (meParticipant && meParticipant.paidAmount > 0 && payerWalletId) {
        const myBreakdown = result.participantBreakdowns.find(
          (b) => b.participantId === meParticipant.id
        );
        const myOwnShare = myBreakdown ? myBreakdown.finalOwed : 0;
        const paidOut = meParticipant.paidAmount;
        const frontedForOthers = Math.max(0, Math.round((paidOut - myOwnShare) * 100) / 100);

        await tx.wallet.update({
          where: { id: payerWalletId },
          data: { balance: { decrement: paidOut } },
        });

        if (myOwnShare > 0) {
          await tx.transaction.create({
            data: {
              type: 'EXPENSE',
              amount: myOwnShare,
              category: 'Shared Bills',
              note: `${title} (My share of split bill)`,
              date: billDate,
              walletId: payerWalletId,
            },
          });
        }

        if (frontedForOthers > 0) {
          await tx.transaction.create({
            data: {
              type: 'SETTLEMENT_OUT',
              amount: frontedForOthers,
              category: 'Bill Receivable',
              note: `${title} (Paid on behalf of group — pending settlement)`,
              date: billDate,
              walletId: payerWalletId,
            },
          });
        }
      }

      return bill;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save bill split';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
