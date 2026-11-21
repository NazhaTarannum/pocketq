import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/auth';
import {
  calculateNextDueDate,
  computeCycleDateFromAnchor,
  evaluateSubscriptionStatus,
  normalizeCalendarDate,
  resolveIntervalSpec,
} from '@/lib/subscriptions';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const existing = await prisma.subscription.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const body = await req.json();
    const action = String(body.action || 'UPDATE').toUpperCase();

    // -------------------------------------------------------------------------
    // ACTION 1: SETTLE_PAYMENT (Strict due-date validation + ledger sync)
    // -------------------------------------------------------------------------
    if (action === 'SETTLE_PAYMENT') {
      const eligibility = evaluateSubscriptionStatus({
        status: existing.status,
        nextRenewalDate: existing.nextRenewalDate,
        lastPaidDate: existing.lastPaidDate,
      });

      if (!eligibility.canSettle) {
        return NextResponse.json(
          {
            error:
              eligibility.blockReason ||
              'Future subscription bills cannot be settled before their due date.',
          },
          { status: 400 }
        );
      }

      const walletId = body.walletId ? String(body.walletId) : existing.defaultWalletId;
      if (!walletId) {
        return NextResponse.json(
          { error: 'Please select a payment wallet to settle this subscription.' },
          { status: 400 }
        );
      }

      const wallet = await prisma.wallet.findFirst({
        where: { id: walletId, userId },
      });
      if (!wallet) {
        return NextResponse.json({ error: 'Selected wallet not found' }, { status: 404 });
      }

      const chargeAmount =
        body.amount !== undefined && Number(body.amount) > 0
          ? Number(body.amount)
          : existing.amount;
      const settledDate = new Date();
      const settledDueDate = normalizeCalendarDate(existing.nextRenewalDate);
      const paymentNote = body.note ? String(body.note).trim() : existing.note;

      // Advance nextRenewalDate to the next recurring cycle from the anchor start date
      const nextDueDate = calculateNextDueDate(
        {
          startDate: existing.startDate,
          billingCycle: existing.billingCycle,
          customIntervalValue: existing.customIntervalValue,
          customIntervalUnit: existing.customIntervalUnit,
          customCycleDays: existing.customCycleDays,
        },
        settledDueDate
      );

      const updatedSub = await prisma.$transaction(async (tx) => {
        // 1. Deduct amount from the selected wallet
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: chargeAmount } },
        });

        // 2. Record subscription payment as an EXPENSE transaction in PocketQ's main ledger
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'EXPENSE',
            amount: chargeAmount,
            category: existing.category || 'Subscriptions',
            note: `${existing.name} subscription (${existing.billingCycle})`,
            date: settledDate,
          },
        });

        // 3. Record immutable payment history entry
        await tx.subscriptionPayment.create({
          data: {
            subscriptionId: existing.id,
            userId,
            walletId: wallet.id,
            walletName: wallet.name,
            amount: chargeAmount,
            dueDate: settledDueDate,
            paidDate: settledDate,
            note: paymentNote,
          },
        });

        // 4. Advance next due date & record lastPaidDate
        return tx.subscription.update({
          where: { id: existing.id },
          data: {
            nextRenewalDate: nextDueDate,
            lastPaidDate: settledDate,
            defaultWalletId: wallet.id,
          },
        });
      });

      return NextResponse.json({ success: true, subscription: updatedSub });
    }

    // -------------------------------------------------------------------------
    // ACTION 2: TOGGLE_STATUS (Cancel or Reactivate)
    // -------------------------------------------------------------------------
    if (action === 'TOGGLE_STATUS') {
      const nextStatus = body.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE';
      const updated = await prisma.subscription.update({
        where: { id: existing.id },
        data: { status: nextStatus },
      });
      return NextResponse.json({ success: true, subscription: updated });
    }

    // -------------------------------------------------------------------------
    // ACTION 3: UPDATE (Edit subscription details & recalculate due date if schedule changed)
    // -------------------------------------------------------------------------
    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    const amount = body.amount !== undefined ? Number(body.amount) : existing.amount;
    const billingCycle =
      body.billingCycle !== undefined
        ? String(body.billingCycle).toUpperCase()
        : existing.billingCycle;
    const startDate =
      body.startDate !== undefined
        ? normalizeCalendarDate(body.startDate)
        : normalizeCalendarDate(existing.startDate);
    const note = body.note !== undefined ? (body.note ? String(body.note).trim() : null) : existing.note;
    const defaultWalletId =
      body.defaultWalletId !== undefined
        ? body.defaultWalletId
          ? String(body.defaultWalletId)
          : null
        : existing.defaultWalletId;

    if (!name) {
      return NextResponse.json({ error: 'Subscription name is required' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Price must be greater than 0' }, { status: 400 });
    }

    const customIntervalValue =
      billingCycle === 'CUSTOM'
        ? Math.max(1, Math.floor(Number(body.customIntervalValue ?? existing.customIntervalValue ?? 1)))
        : null;
    const customIntervalUnit =
      billingCycle === 'CUSTOM'
        ? String(body.customIntervalUnit ?? existing.customIntervalUnit ?? 'MONTHS').toUpperCase()
        : null;

    const spec = resolveIntervalSpec({
      startDate,
      billingCycle,
      customIntervalValue,
      customIntervalUnit,
    });

    const customCycleDays =
      billingCycle === 'CUSTOM'
        ? spec.unit === 'DAYS'
          ? spec.step
          : spec.unit === 'WEEKS'
            ? spec.step * 7
            : spec.unit === 'MONTHS'
              ? spec.step * 30
              : spec.step * 365
        : null;

    const scheduleChanged =
      body.startDate !== undefined ||
      body.billingCycle !== undefined ||
      body.customIntervalValue !== undefined ||
      body.customIntervalUnit !== undefined;

    const nextRenewalDate = scheduleChanged
      ? computeCycleDateFromAnchor(
          {
            startDate,
            billingCycle,
            customIntervalValue,
            customIntervalUnit,
            customCycleDays,
          },
          1
        )
      : existing.nextRenewalDate;

    const updated = await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        name,
        amount,
        startDate,
        billingCycle,
        customIntervalValue,
        customIntervalUnit,
        customCycleDays,
        defaultWalletId,
        nextRenewalDate,
        note,
      },
    });

    return NextResponse.json({ success: true, subscription: updated });
  } catch (error) {
    console.error('PATCH /api/subscriptions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const existing = await prisma.subscription.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    await prisma.subscription.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/subscriptions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }
}
