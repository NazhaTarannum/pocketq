/**
 * @file app/api/bill-splits/[id]/route.ts
 * @description REST API for recording partial/full bill split settlements (with wallet integration) and deleting bill splits.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/auth';

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.userId;
    const { id: billId } = await context.params;
    const body = await req.json();

    const bill = await prisma.billSplit.findFirst({
      where: { id: billId, userId },
      include: {
        settlements: {
          include: {
            fromParticipant: true,
            toParticipant: true,
          },
        },
        participants: true,
      },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill split not found' }, { status: 404 });
    }

    const settlementId = String(body.settlementId || '').trim();
    const paymentAmount = Number(body.paymentAmount);
    const paidDate = body.paidDate ? new Date(body.paidDate) : new Date();
    const walletId = body.walletId ? String(body.walletId).trim() : null;
    const note = body.note ? String(body.note).trim() : null;

    const settlement = bill.settlements.find((s) => s.id === settlementId);
    if (!settlement) {
      return NextResponse.json({ error: 'Settlement record not found' }, { status: 404 });
    }

    const remainingDue = Math.max(
      0,
      Math.round((settlement.amount - settlement.paidAmount) * 100) / 100
    );

    if (Number.isNaN(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than zero' }, { status: 400 });
    }

    if (paymentAmount - remainingDue > 0.01) {
      return NextResponse.json(
        { error: `Payment exceeds remaining balance (${remainingDue.toFixed(2)})` },
        { status: 400 }
      );
    }

    if (walletId) {
      const wallet = await prisma.wallet.findFirst({
        where: { id: walletId, userId },
      });
      if (!wallet) {
        return NextResponse.json({ error: 'Selected wallet not found' }, { status: 404 });
      }
    }

    const updatedBill = await prisma.$transaction(async (tx) => {
      const newPaidAmount = Math.min(
        settlement.amount,
        Math.round((settlement.paidAmount + paymentAmount) * 100) / 100
      );
      const isFullyPaid = settlement.amount - newPaidAmount <= 0.01;
      const newStatus = isFullyPaid ? 'PAID' : 'PARTIAL';

      await tx.billSettlement.update({
        where: { id: settlement.id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
          paidDate,
          walletId: walletId || settlement.walletId,
          note: note || settlement.note,
        },
      });

      // Integrate confirmed settlement with the user's wallet without creating duplicate income or expenses:
      // - If creditor isMe (friend paid me back): increment wallet & log SETTLEMENT_IN (excluded from INCOME metrics).
      // - If debtor isMe (I paid a friend back): decrement wallet & log EXPENSE for my settled share (if not already recorded).
      if (walletId) {
        if (settlement.toParticipant.isMe) {
          await tx.wallet.update({
            where: { id: walletId },
            data: { balance: { increment: paymentAmount } },
          });
          await tx.transaction.create({
            data: {
              type: 'SETTLEMENT_IN',
              amount: paymentAmount,
              category: 'Bill Settlement',
              note:
                note ||
                `Settlement received from ${settlement.fromParticipant.name} (${bill.title})`,
              date: paidDate,
              walletId,
            },
          });
        } else if (settlement.fromParticipant.isMe) {
          await tx.wallet.update({
            where: { id: walletId },
            data: { balance: { decrement: paymentAmount } },
          });
          await tx.transaction.create({
            data: {
              type: 'EXPENSE',
              amount: paymentAmount,
              category: 'Shared Bills',
              note:
                note ||
                `Paid ${settlement.toParticipant.name} for ${bill.title}`,
              date: paidDate,
              walletId,
            },
          });
        }
      }

      // Refresh participant and overall bill settlement status
      const allSettlements = await tx.billSettlement.findMany({
        where: { billSplitId: bill.id },
      });

      for (const p of bill.participants) {
        const related = allSettlements.filter(
          (s) => s.fromParticipantId === p.id || s.toParticipantId === p.id
        );
        const participantSettled = related.every((s) => s.status === 'PAID');
        await tx.splitParticipant.update({
          where: { id: p.id },
          data: { isSettled: participantSettled },
        });
      }

      const allBillSettled = allSettlements.every((s) => s.status === 'PAID');
      return tx.billSplit.update({
        where: { id: bill.id },
        data: { status: allBillSettled ? 'SETTLED' : 'CONFIRMED' },
        include: {
          participants: true,
          items: { include: { assignments: true } },
          extraCharges: true,
          settlements: {
            include: {
              fromParticipant: { select: { id: true, name: true, isMe: true } },
              toParticipant: { select: { id: true, name: true, isMe: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(updatedBill);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to record settlement';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.userId;
    const { id } = await context.params;

    const existing = await prisma.billSplit.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Bill split not found' }, { status: 404 });
    }

    await prisma.billSplit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete bill split';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
