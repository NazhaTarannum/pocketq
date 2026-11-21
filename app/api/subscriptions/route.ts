import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/auth';
import {
  computeCycleDateFromAnchor,
  computeNormalizedCosts,
  evaluateSubscriptionStatus,
  formatFrequencyLabel,
  generateUpcomingSchedule,
  normalizeCalendarDate,
  resolveIntervalSpec,
} from '@/lib/subscriptions';

export async function GET() {
  try {
    const session = await getCurrentSession();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [settings, wallets, subscriptions, payments] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.wallet.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.subscription.findMany({
        where: { userId },
        include: {
          payments: {
            orderBy: { paidDate: 'desc' },
            take: 20,
          },
        },
        orderBy: [{ status: 'asc' }, { nextRenewalDate: 'asc' }],
      }),
      prisma.subscriptionPayment.findMany({
        where: { userId },
        include: {
          subscription: {
            select: { id: true, name: true },
          },
        },
        orderBy: { paidDate: 'desc' },
        take: 50,
      }),
    ]);

    const walletMap = new Map(wallets.map((w) => [w.id, w.name]));

    let activeCount = 0;
    let cancelledCount = 0;
    let dueNowCount = 0;
    let totalMonthlyCost = 0;
    let totalYearlyCost = 0;

    const enrichedSubscriptions = subscriptions.map((sub) => {
      const config = {
        startDate: sub.startDate,
        billingCycle: sub.billingCycle,
        customIntervalValue: sub.customIntervalValue,
        customIntervalUnit: sub.customIntervalUnit,
        customCycleDays: sub.customCycleDays,
      };

      const statusEval = evaluateSubscriptionStatus({
        status: sub.status,
        nextRenewalDate: sub.nextRenewalDate,
        lastPaidDate: sub.lastPaidDate,
      });

      const costs = computeNormalizedCosts(sub.amount, config);
      const upcomingDates =
        sub.status === 'ACTIVE' ? generateUpcomingSchedule(config, sub.nextRenewalDate, 5) : [];

      if (sub.status === 'ACTIVE') {
        activeCount += 1;
        totalMonthlyCost += costs.monthlyEquivalent;
        totalYearlyCost += costs.yearlyEquivalent;
        if (statusEval.canSettle) {
          dueNowCount += 1;
        }
      } else {
        cancelledCount += 1;
      }

      return {
        ...sub,
        frequencyLabel: formatFrequencyLabel(config),
        defaultWalletName: sub.defaultWalletId ? walletMap.get(sub.defaultWalletId) || null : null,
        displayStatus: statusEval.displayStatus,
        daysUntilDue: statusEval.daysUntilDue,
        canSettle: statusEval.canSettle,
        blockReason: statusEval.blockReason,
        monthlyEquivalent: costs.monthlyEquivalent,
        yearlyEquivalent: costs.yearlyEquivalent,
        upcomingDates,
      };
    });

    return NextResponse.json({
      settings: {
        currencySymbol: settings?.currencySymbol || '৳',
      },
      wallets,
      subscriptions: enrichedSubscriptions,
      paymentHistory: payments,
      summary: {
        activeCount,
        cancelledCount,
        dueNowCount,
        totalMonthlyCost: Number(totalMonthlyCost.toFixed(2)),
        totalYearlyCost: Number(totalYearlyCost.toFixed(2)),
      },
    });
  } catch (error) {
    console.error('GET /api/subscriptions error:', error);
    return NextResponse.json({ error: 'Failed to load subscriptions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    const userId = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body.name || '').trim();
    const amount = Number(body.amount);
    const billingCycle = String(body.billingCycle || 'MONTHLY').toUpperCase();
    const note = body.note ? String(body.note).trim() : null;
    const defaultWalletId = body.defaultWalletId ? String(body.defaultWalletId) : null;

    if (!name) {
      return NextResponse.json({ error: 'Subscription name is required' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Subscription price must be greater than 0' }, { status: 400 });
    }
    if (!body.startDate) {
      return NextResponse.json({ error: 'Purchase / start date is required' }, { status: 400 });
    }

    const startDate = normalizeCalendarDate(body.startDate);
    const customIntervalValue =
      billingCycle === 'CUSTOM' ? Math.max(1, Math.floor(Number(body.customIntervalValue) || 1)) : null;
    const customIntervalUnit =
      billingCycle === 'CUSTOM'
        ? String(body.customIntervalUnit || 'MONTHS').toUpperCase()
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

    // Automatically calculate the first due date from the purchase/start date and billing frequency
    const nextRenewalDate = computeCycleDateFromAnchor(
      {
        startDate,
        billingCycle,
        customIntervalValue,
        customIntervalUnit,
        customCycleDays,
      },
      1
    );

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        name,
        amount,
        startDate,
        billingCycle,
        customIntervalValue,
        customIntervalUnit,
        customCycleDays,
        defaultWalletId,
        nextRenewalDate,
        status: 'ACTIVE',
        note,
      },
    });

    return NextResponse.json({ success: true, subscription }, { status: 201 });
  } catch (error) {
    console.error('POST /api/subscriptions error:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}
