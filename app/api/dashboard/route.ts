/**
 * @file app/api/dashboard/route.ts
 * @description Core REST API aggregating financial state, safe-to-spend calculations, forecasts, and mutations for wallets, transactions, obligations, budgets, loans, subscriptions, and investments.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.userId;
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const [
      settings,
      wallets,
      transactions,
      yearTx,
      expectedIncomes,
      budgets,
      obligations,
      savingsGoals,
      loans,
      purchasePlans,
      customCategories,
      billSplits,
      subscriptions,
      investments,
    ] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.wallet.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.transaction.findMany({
        where: { wallet: { userId } },
        include: { wallet: true, targetWallet: true },
        orderBy: { date: 'desc' },
        take: 40,
      }),
      prisma.transaction.findMany({
        where: { wallet: { userId }, date: { gte: oneYearAgo } },
        orderBy: { date: 'asc' },
      }),
      prisma.expectedIncome.findMany({
        where: { userId },
        orderBy: [{ isReceived: 'asc' }, { expectedDate: 'asc' }],
      }),
      prisma.budget.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.obligation.findMany({
        where: { userId },
        include: {
          installments: { orderBy: { dueDate: 'asc' } },
          targetWallet: true,
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.savingsGoal.findMany({
        where: { userId },
        include: { transactions: { orderBy: { date: 'desc' }, take: 20 } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.loan.findMany({
        where: { userId },
        include: { payments: { orderBy: { date: 'desc' }, take: 15 } },
        orderBy: [{ isClosed: 'asc' }, { nextDueDate: 'asc' }],
      }),
      prisma.purchasePlan.findMany({
        where: { userId },
        orderBy: [{ isPurchased: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.customCategory.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
      }),
      prisma.billSplit.findMany({
        where: { userId },
        include: { participants: true },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      prisma.subscription.findMany({
        where: { userId },
        orderBy: [{ status: 'asc' }, { nextRenewalDate: 'asc' }],
      }),
      prisma.investment.findMany({
        where: { userId },
        include: { events: { orderBy: { eventDate: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);

    // Reserved Funds = ONLY money manually set aside for Obligations + Savings (never auto-deducts unreserved commitments!)
    const totalReservedObligations = obligations.reduce(
      (sum, o) => sum + (o.isPaid ? 0 : Math.max(0, o.reservedAmount)),
      0
    );

    const totalReservedSavings = savingsGoals.reduce(
      (sum, s) => sum + Math.max(0, s.currentBalance),
      0
    );

    const totalReserved = totalReservedObligations + totalReservedSavings;
    const availableToSpend = totalBalance - totalReserved;

    const owedByFriends = billSplits.reduce((sum, split) => {
      if (!split.paidByMe) return sum;
      const pending = split.participants
        .filter((p) => !p.isMe && !p.isSettled)
        .reduce((pSum, p) => pSum + p.finalOwed, 0);
      return sum + pending;
    }, 0);

    // Real Cash Flow Metrics (30-day, 90-day & yearly)
    const tx30 = yearTx.filter((t) => new Date(t.date) >= thirtyDaysAgo);
    const recent90Tx = yearTx.filter((t) => new Date(t.date) >= ninetyDaysAgo);

    const monthlyIncome = tx30
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);
    const monthlyExpenses = tx30
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    const total90Income = recent90Tx
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);
    const total90Expenses = recent90Tx
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    const pendingExpectedIncome30 = expectedIncomes
      .filter(
        (ei) =>
          !ei.isReceived &&
          new Date(ei.expectedDate).getTime() <= now.getTime() + 35 * 24 * 60 * 60 * 1000
      )
      .reduce((sum, ei) => sum + Math.max(0, ei.amount - ei.receivedAmount), 0);

    const baseIncomeEstimate =
      monthlyIncome > 0 && total90Income > monthlyIncome
        ? Math.round(monthlyIncome * 0.65 + (total90Income / 3) * 0.35)
        : monthlyIncome;
    const expectedMonthlyIncome = Math.max(baseIncomeEstimate, pendingExpectedIncome30);

    const expectedMonthlyExpenses =
      monthlyExpenses > 0 && total90Expenses > monthlyExpenses
        ? Math.round(monthlyExpenses * 0.65 + (total90Expenses / 3) * 0.35)
        : monthlyExpenses;

    const expectedMonthlySurplus = Math.max(0, expectedMonthlyIncome - expectedMonthlyExpenses);

    // Loans breakdown: BORROWED (I owe) vs LENT (Owed to me)
    const borrowedLoans = loans.filter((l) => l.direction !== 'LENT' && !l.isClosed && l.remaining > 0);
    const lentLoans = loans.filter((l) => l.direction === 'LENT' && !l.isClosed && l.remaining > 0);

    const totalLoanRemaining = borrowedLoans.reduce((sum, l) => sum + l.remaining, 0);
    const totalLentRemaining = lentLoans.reduce((sum, l) => sum + l.remaining, 0);
    const monthlyLoanCommitment = borrowedLoans.reduce(
      (sum, l) => sum + Math.min(l.remaining, l.monthlyEmi),
      0
    );

    // Flexible Budgets enrichment (actual 30d spend vs monthly limit + income-adjusted recommendation)
    const incomeRatio =
      baseIncomeEstimate > 0 && monthlyIncome > 0 ? monthlyIncome / baseIncomeEstimate : 1;

    const enrichedBudgets = budgets.map((b) => {
      const spent = tx30
        .filter((t) => t.type === 'EXPENSE' && t.category.toLowerCase() === b.category.toLowerCase())
        .reduce((sum, t) => sum + t.amount, 0);

      const adjustedLimit = b.isFlexible
        ? Math.round(b.monthlyLimit * Math.min(1.25, Math.max(0.7, incomeRatio)))
        : b.monthlyLimit;

      const remaining = adjustedLimit - spent;
      const usagePercent = adjustedLimit > 0 ? Math.round((spent / adjustedLimit) * 100) : 0;
      const isOverspent = spent > adjustedLimit;
      const isNearLimit = !isOverspent && usagePercent >= 80;

      return {
        ...b,
        spent,
        adjustedLimit,
        remaining,
        usagePercent,
        isOverspent,
        isNearLimit,
      };
    });

    // Deadline-Based Adaptive Funding Planner for Reserved Obligations
    const monthCapacities: number[] = [];
    for (let m = 0; m < 12; m++) {
      if (m === 0) {
        const usableLiquidNow = Math.max(0, availableToSpend * 0.8);
        const currentSurplus = Math.max(0, monthlyIncome - monthlyExpenses - monthlyLoanCommitment);
        monthCapacities.push(Math.round(usableLiquidNow + currentSurplus));
      } else {
        const futureSurplus = Math.max(0, expectedMonthlySurplus - monthlyLoanCommitment);
        monthCapacities.push(Math.round(futureSurplus));
      }
    }

    const remainingCapacityByMonth = [...monthCapacities];

    const enrichedObligations = obligations.map((ob) => {
      const outstandingTotal = Math.max(0, ob.totalAmount - ob.paidAmount);
      const remainingToReserve = ob.isPaid
        ? 0
        : Math.max(0, outstandingTotal - ob.reservedAmount);

      const nextUnpaidInst = ob.installments.find((i) => !i.isPaid);
      const effectiveDueDate = nextUnpaidInst ? new Date(nextUnpaidInst.dueDate) : new Date(ob.dueDate);
      const daysRemaining = Math.ceil(
        (effectiveDueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );
      const monthsRemaining = Math.max(1, Math.ceil(Math.max(1, daysRemaining) / 30));

      let customSchedule: Array<{ monthIndex: number; label: string; amount: number }> | null = null;
      if (ob.customPlanJson) {
        try {
          const parsed = JSON.parse(ob.customPlanJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            customSchedule = parsed;
          }
        } catch {
          customSchedule = null;
        }
      }

      if (ob.isPaid || remainingToReserve <= 0) {
        return {
          ...ob,
          outstandingTotal,
          remainingToReserve: 0,
          daysRemaining,
          monthsRemaining,
          fundingPlan: {
            schedule: [],
            totalPlanned: 0,
            projectedShortfall: 0,
            isShortfall: false,
            shortfallMessage: null,
            isCustomPlan: Boolean(customSchedule),
          },
        };
      }

      const schedule: Array<{ monthIndex: number; label: string; amount: number }> = [];
      let stillNeeded = remainingToReserve;

      if (customSchedule) {
        for (let idx = 0; idx < customSchedule.length; idx++) {
          const entry = customSchedule[idx];
          const amt = Math.max(0, Number(entry.amount) || 0);
          schedule.push({
            monthIndex: idx + 1,
            label: entry.label || `Month ${idx + 1}`,
            amount: amt,
          });
          stillNeeded = Math.max(0, stillNeeded - amt);
          if (idx < remainingCapacityByMonth.length) {
            remainingCapacityByMonth[idx] = Math.max(0, remainingCapacityByMonth[idx] - amt);
          }
        }
      } else {
        const horizon = Math.min(monthsRemaining, remainingCapacityByMonth.length);
        for (let m = 0; m < horizon; m++) {
          const availableThisMonth = remainingCapacityByMonth[m];
          const suggested =
            stillNeeded > 0 ? Math.min(stillNeeded, Math.max(0, Math.round(availableThisMonth))) : 0;
          schedule.push({
            monthIndex: m + 1,
            label: m === 0 ? 'Month 1 (Now)' : `Month ${m + 1}`,
            amount: suggested,
          });
          stillNeeded = Math.max(0, stillNeeded - suggested);
          remainingCapacityByMonth[m] = Math.max(0, remainingCapacityByMonth[m] - suggested);
        }
      }

      const totalPlanned = schedule.reduce((s, item) => s + item.amount, 0);
      const projectedShortfall = Math.max(0, remainingToReserve - totalPlanned);
      const isShortfall = projectedShortfall > 0;

      const shortfallMessage = isShortfall
        ? `Based on your current income and expenses, you may be short by ৳${projectedShortfall.toLocaleString(
            'en-IN'
          )} for ${ob.title}. Consider reducing discretionary spending or adjusting your plan.`
        : null;

      return {
        ...ob,
        outstandingTotal,
        remainingToReserve,
        daysRemaining,
        monthsRemaining,
        fundingPlan: {
          schedule,
          totalPlanned,
          projectedShortfall,
          isShortfall,
          shortfallMessage,
          isCustomPlan: Boolean(customSchedule),
        },
      };
    });

    const totalUnreservedObligations = enrichedObligations.reduce(
      (sum, o) => sum + o.remainingToReserve,
      0
    );
    const totalObligationShortfall = enrichedObligations.reduce(
      (sum, o) => sum + o.fundingPlan.projectedShortfall,
      0
    );

    // =========================================================================
    // Subscription normalization, renewal window detection, and recurring forecast cost aggregation
    // Normalizes MONTHLY, YEARLY, and CUSTOM billing cycles into monthly/yearly
    // burn rates and integrates active recurring charges into future forecasts.
    // =========================================================================
    const activeSubscriptions = subscriptions.filter((s) => s.status === 'ACTIVE');
    const enrichedSubscriptions = subscriptions.map((sub) => {
      const cycleDays =
        sub.billingCycle === 'YEARLY'
          ? 365
          : sub.billingCycle === 'CUSTOM'
          ? Math.max(1, sub.customCycleDays || 30)
          : 30;
      const monthlyEquivalent =
        sub.billingCycle === 'MONTHLY'
          ? sub.amount
          : sub.billingCycle === 'YEARLY'
          ? sub.amount / 12
          : (sub.amount * 30) / cycleDays;
      const yearlyEquivalent =
        sub.billingCycle === 'YEARLY'
          ? sub.amount
          : sub.billingCycle === 'MONTHLY'
          ? sub.amount * 12
          : (sub.amount * 365) / cycleDays;
      const daysUntilRenewal = Math.ceil(
        (new Date(sub.nextRenewalDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );
      return {
        ...sub,
        monthlyEquivalent,
        yearlyEquivalent,
        daysUntilRenewal,
        isDueSoon: sub.status === 'ACTIVE' && daysUntilRenewal <= 7,
      };
    });

    const totalMonthlySubscriptions = Math.round(
      enrichedSubscriptions
        .filter((s) => s.status === 'ACTIVE')
        .reduce((sum, s) => sum + s.monthlyEquivalent, 0)
    );
    const totalYearlySubscriptions = Math.round(
      enrichedSubscriptions
        .filter((s) => s.status === 'ACTIVE')
        .reduce((sum, s) => sum + s.yearlyEquivalent, 0)
    );

    // Include active recurring subscription burn in future cash-flow projections
    const forecastMonthlyExpenses = expectedMonthlyExpenses + totalMonthlySubscriptions;

    // =========================================================================
    // Non-liquid investment valuation, gain/loss metrics, and total net worth aggregation
    // Aggregates principal invested, current valuation, and unrealized gain/loss
    // without adding non-liquid holdings into Safe Available-to-Spend cash.
    // =========================================================================
    const enrichedInvestments = investments.map((inv) => {
      const gainLoss = inv.currentValue - inv.investedAmount;
      const gainLossPercent =
        inv.investedAmount > 0 ? (gainLoss / inv.investedAmount) * 100 : 0;
      return {
        ...inv,
        gainLoss,
        gainLossPercent,
      };
    });

    const totalInvestedAmount = enrichedInvestments.reduce((sum, i) => sum + i.investedAmount, 0);
    const totalInvestmentValue = enrichedInvestments.reduce((sum, i) => sum + i.currentValue, 0);
    const totalInvestmentGainLoss = totalInvestmentValue - totalInvestedAmount;
    const totalInvestmentReturnPct =
      totalInvestedAmount > 0 ? (totalInvestmentGainLoss / totalInvestedAmount) * 100 : 0;

    // 3-Scenario Financial Forecast: OPTIMISTIC (+15% income, -10% spend), EXPECTED, CONSERVATIVE (-20% income, +10% spend)
    const buildScenario = (incomeMult: number, expenseMult: number) => {
      const scenarioNet =
        expectedMonthlyIncome * incomeMult -
        forecastMonthlyExpenses * expenseMult -
        monthlyLoanCommitment;

      return [30, 60, 90].map((days) => {
        const months = days / 30;
        const projectedAvailable = Math.round(availableToSpend + scenarioNet * months);
        const projectedLoanRemaining = Math.max(
          0,
          Math.round(totalLoanRemaining - monthlyLoanCommitment * months)
        );
        return {
          days,
          label: `${days} Days`,
          projectedAvailable,
          projectedLoanRemaining,
          projectedSavings: Math.round(totalReservedSavings),
          isHealthy: projectedAvailable >= 0,
        };
      });
    };

    const scenarios = {
      OPTIMISTIC: buildScenario(1.15, 0.9),
      EXPECTED: buildScenario(1.0, 1.0),
      CONSERVATIVE: buildScenario(0.8, 1.1),
    };

    // Future Purchase Plans
    const monthlyObligationSetAside = enrichedObligations.reduce(
      (sum, o) => sum + (o.fundingPlan.schedule[0]?.amount || 0),
      0
    );
    const monthlyPurchaseCapacity = Math.max(
      0,
      expectedMonthlyIncome - expectedMonthlyExpenses - monthlyLoanCommitment - monthlyObligationSetAside
    );

    const enrichedPurchasePlans = purchasePlans.map((plan) => {
      const remainingCost = Math.max(0, plan.estimatedCost - plan.savedSoFar);
      const canBuyRightNow = !plan.isPurchased && availableToSpend >= remainingCost;
      const monthsNeeded =
        remainingCost === 0
          ? 0
          : monthlyPurchaseCapacity > 0
          ? Math.ceil(remainingCost / monthlyPurchaseCapacity)
          : null;

      const estimatedReadyDate =
        monthsNeeded !== null
          ? new Date(now.getTime() + monthsNeeded * 30 * 24 * 60 * 60 * 1000).toISOString()
          : null;

      return {
        ...plan,
        remainingCost,
        canBuyRightNow,
        monthlyAllocation: monthlyPurchaseCapacity,
        monthsNeeded,
        estimatedReadyDate,
        impactSummary: plan.isPurchased
          ? 'Purchased & completed'
          : canBuyRightNow
          ? 'Safe to buy now without touching reserved obligations or savings'
          : monthsNeeded !== null
          ? `Ready in ~${monthsNeeded} mo (৳${monthlyPurchaseCapacity.toLocaleString(
              'en-IN'
            )}/mo free surplus after obligations & loans)`
          : 'Waiting for free monthly surplus after mandatory obligations & loans',
      };
    });

    // Monthly & Yearly Reports Aggregation (last 6 months + yearly totals)
    const monthlyReportMap = new Map<string, { month: string; income: number; expense: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthlyReportMap.set(key, { month: label, income: 0, expense: 0 });
    }
    for (const tx of yearTx) {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthlyReportMap.get(key);
      if (entry) {
        if (tx.type === 'INCOME') entry.income += tx.amount;
        if (tx.type === 'EXPENSE') entry.expense += tx.amount;
      }
    }
    const monthlySeries = Array.from(monthlyReportMap.values());
    const yearlyIncome = yearTx
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);
    const yearlyExpenses = yearTx
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    // Financial Calendar Events (Obligation deadlines, Installments, Expected Incomes, Loan due dates, Recurring expenses)
    const calendarEvents: Array<{
      id: string;
      date: string;
      title: string;
      amount: number;
      kind: 'OBLIGATION' | 'EXPECTED_INCOME' | 'LOAN' | 'RECURRING_EXPENSE';
      status: string;
    }> = [];

    for (const ob of enrichedObligations) {
      if (!ob.isPaid) {
        calendarEvents.push({
          id: `ob-${ob.id}`,
          date: new Date(ob.dueDate).toISOString(),
          title: ob.title,
          amount: ob.outstandingTotal,
          kind: 'OBLIGATION',
          status: ob.remainingToReserve === 0 ? 'Fully Reserved' : `৳${ob.remainingToReserve.toLocaleString('en-IN')} to reserve`,
        });
      }
    }
    for (const ei of expectedIncomes) {
      if (!ei.isReceived) {
        calendarEvents.push({
          id: `ei-${ei.id}`,
          date: new Date(ei.expectedDate).toISOString(),
          title: `Expected: ${ei.title}`,
          amount: Math.max(0, ei.amount - ei.receivedAmount),
          kind: 'EXPECTED_INCOME',
          status: ei.sourceType,
        });
      }
    }
    for (const loan of loans) {
      if (!loan.isClosed && loan.remaining > 0) {
        calendarEvents.push({
          id: `loan-${loan.id}`,
          date: new Date(loan.nextDueDate).toISOString(),
          title: `${loan.direction === 'LENT' ? 'Collect Loan' : 'Loan EMI'}: ${loan.title}`,
          amount: Math.min(loan.remaining, loan.monthlyEmi),
          kind: 'LOAN',
          status: loan.direction,
        });
      }
    }
    for (const sub of activeSubscriptions) {
      calendarEvents.push({
        id: `sub-${sub.id}`,
        date: new Date(sub.nextRenewalDate).toISOString(),
        title: `Subscription: ${sub.name}`,
        amount: sub.amount,
        kind: 'OBLIGATION',
        status: `${sub.billingCycle} renewal`,
      });
    }
    calendarEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Smart Notifications Feed
    const notifications: Array<{
      id: string;
      severity: 'WARNING' | 'INFO' | 'POSITIVE';
      title: string;
      message: string;
    }> = [];

    // Upcoming Subscription Renewal Reminders (within 7 days or overdue)
    for (const sub of enrichedSubscriptions) {
      if (sub.isDueSoon) {
        notifications.push({
          id: `sub-renew-${sub.id}`,
          severity: sub.daysUntilRenewal <= 2 ? 'WARNING' : 'INFO',
          title: `Subscription Renewal: ${sub.name}`,
          message:
            sub.daysUntilRenewal < 0
              ? `${sub.name} renewal of ৳${sub.amount.toLocaleString('en-IN')} is overdue by ${Math.abs(
                  sub.daysUntilRenewal
                )} day(s).`
              : `${sub.name} (৳${sub.amount.toLocaleString('en-IN')}) renews in ${
                  sub.daysUntilRenewal
                } day(s).`,
        });
      }
    }

    const lowThresh = settings?.lowBalanceThreshold ?? 2000;
    if (availableToSpend < lowThresh) {
      notifications.push({
        id: 'low-avail',
        severity: 'WARNING',
        title: 'Low Available-to-Spend Balance',
        message: `Your unreserved cash is ৳${Math.round(availableToSpend).toLocaleString(
          'en-IN'
        )}, below your ৳${lowThresh.toLocaleString('en-IN')} comfort threshold.`,
      });
    }

    for (const ob of enrichedObligations) {
      if (!ob.isPaid && ob.fundingPlan.isShortfall && ob.fundingPlan.shortfallMessage) {
        notifications.push({
          id: `shortfall-${ob.id}`,
          severity: 'WARNING',
          title: `Deadline Alert: ${ob.title}`,
          message: ob.fundingPlan.shortfallMessage,
        });
      } else if (!ob.isPaid && ob.daysRemaining <= 10 && ob.daysRemaining >= 0) {
        notifications.push({
          id: `due-soon-${ob.id}`,
          severity: 'INFO',
          title: `Upcoming Deadline (${ob.daysRemaining}d left)`,
          message: `${ob.title} is due on ${new Date(ob.dueDate).toLocaleDateString(
            'en-GB'
          )}. Reserved: ৳${ob.reservedAmount.toLocaleString('en-IN')} / ৳${ob.outstandingTotal.toLocaleString('en-IN')}.`,
        });
      }
    }

    for (const b of enrichedBudgets) {
      if (b.isOverspent) {
        notifications.push({
          id: `budget-over-${b.id}`,
          severity: 'WARNING',
          title: `${b.category} Budget Exceeded`,
          message: `You spent ৳${b.spent.toLocaleString('en-IN')} against your adjusted limit of ৳${b.adjustedLimit.toLocaleString('en-IN')}.`,
        });
      } else if (b.isNearLimit) {
        notifications.push({
          id: `budget-near-${b.id}`,
          severity: 'INFO',
          title: `${b.category} Budget at ${b.usagePercent}%`,
          message: `৳${b.remaining.toLocaleString('en-IN')} remaining in your ${b.category} budget this month.`,
        });
      }
    }

    if (notifications.length === 0) {
      notifications.push({
        id: 'all-calm',
        severity: 'POSITIVE',
        title: 'Everything Looks Steady',
        message:
          'No budget overruns, low-balance alerts, or deadline shortfalls right now. You are in control.',
      });
    }

    return NextResponse.json({
      settings,
      summary: {
        totalBalance,
        totalReserved,
        totalReservedObligations,
        totalReservedSavings,
        totalUnreservedObligations,
        totalObligationShortfall,
        totalLoanRemaining,
        totalLentRemaining,
        monthlyLoanCommitment,
        pendingExpectedIncome30,
        availableToSpend,
        owedByFriends,
      },
      plannerContext: {
        monthlyIncome,
        monthlyExpenses,
        expectedMonthlyIncome,
        expectedMonthlyExpenses,
        monthlyLoanCommitment,
        monthlyObligationSetAside,
        monthlyPurchaseCapacity,
        totalObligationShortfall,
        forecast: scenarios.EXPECTED,
        scenarios,
      },
      reports: {
        monthlySeries,
        yearlyIncome,
        yearlyExpenses,
        yearlyNet: yearlyIncome - yearlyExpenses,
      },
      calendarEvents,
      notifications,
      wallets,
      transactions,
      expectedIncomes,
      budgets: enrichedBudgets,
      obligations: enrichedObligations,
      savingsGoals,
      loans,
      purchasePlans: enrichedPurchasePlans,
      customCategories,
      billSplits,
      subscriptions: enrichedSubscriptions,
      subscriptionSummary: {
        activeCount: activeSubscriptions.length,
        cancelledCount: subscriptions.length - activeSubscriptions.length,
        totalMonthlyCost: totalMonthlySubscriptions,
        totalYearlyCost: totalYearlySubscriptions,
      },
      investments: enrichedInvestments,
      investmentSummary: {
        totalInvested: totalInvestedAmount,
        currentValue: totalInvestmentValue,
        gainLoss: totalInvestmentGainLoss,
        returnPercent: totalInvestmentReturnPct,
        netWorthIncludingInvestments: totalBalance + totalInvestmentValue,
      },
    });
  } catch (error) {
    console.error('Dashboard GET error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.userId;
    const body = await request.json();
    const { action } = body;

    if (action === 'TRANSACTION') {
      const { type, amount, category, note, walletId, targetWalletId, isRecurring, expectedAmount } =
        body;
      const numericAmount = Number(amount);

      const tx = await prisma.transaction.create({
        data: {
          type,
          amount: numericAmount,
          category,
          note,
          isRecurring: Boolean(isRecurring),
          expectedAmount: expectedAmount ? Number(expectedAmount) : null,
          walletId,
          targetWalletId: type === 'TRANSFER' ? targetWalletId : null,
        },
      });

      if (type === 'INCOME') {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { increment: numericAmount } },
        });
      } else if (type === 'EXPENSE') {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: numericAmount } },
        });
      } else if (type === 'TRANSFER' && targetWalletId) {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: numericAmount } },
        });
        await prisma.wallet.update({
          where: { id: targetWalletId },
          data: { balance: { increment: numericAmount } },
        });
      }

      return NextResponse.json({ success: true, transaction: tx });
    }

    // Expected Income Management (kept separate from wallet cash until confirmed received!)
    if (action === 'CREATE_EXPECTED_INCOME') {
      const { title, sourceType, amount, expectedDate, isRecurring, targetWalletId, notes } = body;
      const ei = await prisma.expectedIncome.create({
        data: {
          userId,
          title: title.trim(),
          sourceType: sourceType || 'FIXED',
          amount: Math.max(0, Number(amount) || 0),
          expectedDate: new Date(expectedDate),
          isRecurring: Boolean(isRecurring),
          targetWalletId: targetWalletId || null,
          notes: notes?.trim() || null,
        },
      });
      return NextResponse.json({ success: true, expectedIncome: ei });
    }

    if (action === 'RECEIVE_EXPECTED_INCOME') {
      const { expectedIncomeId, amount, walletId, receivedDate } = body;
      const ei = await prisma.expectedIncome.findUnique({ where: { id: expectedIncomeId } });
      if (!ei) return NextResponse.json({ error: 'Expected income not found' }, { status: 404 });

      const recAmt = Math.max(0, Number(amount) || Math.max(0, ei.amount - ei.receivedAmount));
      const nextReceived = ei.receivedAmount + recAmt;
      const isDone = nextReceived >= ei.amount - 0.01;
      const destWalletId = walletId || ei.targetWalletId;

      await prisma.expectedIncome.update({
        where: { id: ei.id },
        data: {
          receivedAmount: nextReceived,
          isReceived: isDone,
          receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
        },
      });

      if (destWalletId && recAmt > 0) {
        await prisma.wallet.update({
          where: { id: destWalletId },
          data: { balance: { increment: recAmt } },
        });
        await prisma.transaction.create({
          data: {
            type: 'INCOME',
            amount: recAmt,
            category: ei.sourceType === 'FREELANCE' ? 'Freelance' : 'Salary / Income',
            note: `Received expected income: ${ei.title}`,
            expectedAmount: ei.amount,
            date: receivedDate ? new Date(receivedDate) : new Date(),
            walletId: destWalletId,
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'DELETE_EXPECTED_INCOME') {
      const { expectedIncomeId } = body;
      await prisma.expectedIncome.delete({ where: { id: expectedIncomeId } });
      return NextResponse.json({ success: true });
    }

    // Flexible Budgeting
    if (action === 'SAVE_BUDGET') {
      const { category, monthlyLimit, isFlexible, notes } = body;
      const cleanCat = category.trim();
      const existing = await prisma.budget.findFirst({
        where: {
          userId, category: { equals: cleanCat } },
      });
      if (existing) {
        await prisma.budget.update({
          where: { id: existing.id },
          data: {
            monthlyLimit: Math.max(0, Number(monthlyLimit) || 0),
            isFlexible: isFlexible !== undefined ? Boolean(isFlexible) : true,
            notes: notes?.trim() || null,
          },
        });
      } else {
        await prisma.budget.create({
          data: {
            userId,
            category: cleanCat,
            monthlyLimit: Math.max(0, Number(monthlyLimit) || 0),
            isFlexible: isFlexible !== undefined ? Boolean(isFlexible) : true,
            notes: notes?.trim() || null,
          },
        });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'DELETE_BUDGET') {
      const { budgetId } = body;
      await prisma.budget.delete({ where: { id: budgetId } });
      return NextResponse.json({ success: true });
    }

    // Reserved Obligations
    if (action === 'OBLIGATION') {
      const {
        title,
        totalAmount,
        reservedAmount,
        dueDate,
        category,
        notes,
        targetWalletId,
        installments,
      } = body;
      const numTotal = Math.max(0, Number(totalAmount) || 0);
      const numReserved = Math.max(0, Number(reservedAmount) || 0);

      const validInstallments = Array.isArray(installments)
        ? installments.filter(
            (inst: { amount: string | number; dueDate: string }) =>
              Number(inst.amount) > 0 && inst.dueDate
          )
        : [];

      const obligation = await prisma.obligation.create({
        data: {
          userId,
          title: title.trim(),
          totalAmount: numTotal,
          reservedAmount: numReserved,
          dueDate: new Date(dueDate),
          category: category || 'OBLIGATION',
          targetWalletId: targetWalletId || null,
          notes: notes?.trim() || null,
          installments:
            validInstallments.length > 0
              ? {
                  create: validInstallments.map(
                    (
                      inst: { title: string; amount: string | number; dueDate: string },
                      idx: number
                    ) => ({
                      title: inst.title?.trim() || `Installment ${idx + 1}`,
                      amount: Number(inst.amount),
                      dueDate: new Date(inst.dueDate),
                    })
                  ),
                }
              : undefined,
        },
      });
      return NextResponse.json({ success: true, obligation });
    }

    if (action === 'RESERVE_OBLIGATION') {
      const { obligationId, amount, mode, walletId } = body;
      const numericAmount = Math.max(0, Number(amount) || 0);
      const ob = await prisma.obligation.findUnique({ where: { id: obligationId } });
      if (!ob) return NextResponse.json({ error: 'Obligation not found' }, { status: 404 });

      const maxReservable = Math.max(0, ob.totalAmount - ob.paidAmount);
      const rawNextReserved =
        mode === 'SET' ? numericAmount : ob.reservedAmount + numericAmount;
      const newReserved = Math.min(maxReservable, Math.max(0, rawNextReserved));

      const updated = await prisma.obligation.update({
        where: { id: obligationId },
        data: {
          reservedAmount: newReserved,
          targetWalletId: walletId || ob.targetWalletId,
        },
      });
      return NextResponse.json({ success: true, obligation: updated });
    }

    if (action === 'UPDATE_OBLIGATION_PLAN') {
      const { obligationId, schedule } = body;
      const ob = await prisma.obligation.findUnique({ where: { id: obligationId } });
      if (!ob) return NextResponse.json({ error: 'Obligation not found' }, { status: 404 });

      const cleanSchedule = Array.isArray(schedule)
        ? schedule.map((item: { label?: string; amount: number | string }, idx: number) => ({
            monthIndex: idx + 1,
            label: item.label || `Month ${idx + 1}`,
            amount: Math.max(0, Number(item.amount) || 0),
          }))
        : null;

      await prisma.obligation.update({
        where: { id: obligationId },
        data: {
          customPlanJson:
            cleanSchedule && cleanSchedule.length > 0 ? JSON.stringify(cleanSchedule) : null,
        },
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'PAY_OBLIGATION') {
      const { obligationId, installmentId, amount, walletId, paymentDate, note } = body;
      const payAmt = Number(amount) || 0;
      if (payAmt <= 0) return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });

      const ob = await prisma.obligation.findUnique({
        where: { id: obligationId },
        include: { installments: true },
      });
      if (!ob) return NextResponse.json({ error: 'Obligation not found' }, { status: 404 });

      let installmentLabel = '';
      if (installmentId) {
        const inst = ob.installments.find((i) => i.id === installmentId);
        if (inst) {
          const newInstPaid = inst.paidAmount + payAmt;
          const instDone = newInstPaid >= inst.amount - 0.01;
          installmentLabel = ` (${inst.title})`;
          await prisma.obligationInstallment.update({
            where: { id: inst.id },
            data: {
              paidAmount: newInstPaid,
              isPaid: instDone,
            },
          });
        }
      }

      const newPaidAmount = ob.paidAmount + payAmt;
      const newReservedAmount = Math.max(0, ob.reservedAmount - payAmt);
      const isFullyPaid = newPaidAmount >= ob.totalAmount - 0.01;

      await prisma.obligation.update({
        where: { id: ob.id },
        data: {
          paidAmount: newPaidAmount,
          reservedAmount: newReservedAmount,
          isPaid: isFullyPaid,
        },
      });

      const activeWalletId = walletId || ob.targetWalletId;
      if (activeWalletId) {
        await prisma.wallet.update({
          where: { id: activeWalletId },
          data: { balance: { decrement: payAmt } },
        });

        await prisma.transaction.create({
          data: {
            type: 'EXPENSE',
            amount: payAmt,
            category: ob.category || 'Obligation Payment',
            note: note?.trim()
              ? `${ob.title}${installmentLabel} — ${note.trim()}`
              : `Paid ${ob.title}${installmentLabel}`,
            date: paymentDate ? new Date(paymentDate) : new Date(),
            walletId: activeWalletId,
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'DELETE_OBLIGATION') {
      const { obligationId } = body;
      await prisma.obligation.delete({ where: { id: obligationId } });
      return NextResponse.json({ success: true });
    }

    // Flexible Savings
    if (action === 'CREATE_SAVINGS') {
      const { name, initialAmount, targetAmount, targetDate, notes } = body;
      const initAmt = Math.max(0, Number(initialAmount) || 0);

      const goal = await prisma.savingsGoal.create({
        data: {
          userId,
          name: name.trim(),
          currentBalance: initAmt,
          targetAmount: targetAmount ? Number(targetAmount) : null,
          targetDate: targetDate ? new Date(targetDate) : null,
          notes: notes?.trim() || null,
          transactions:
            initAmt > 0
              ? {
                  create: [
                    {
                      type: 'DEPOSIT',
                      amount: initAmt,
                      note: 'Initial reserved savings',
                    },
                  ],
                }
              : undefined,
        },
      });
      return NextResponse.json({ success: true, goal });
    }

    if (action === 'SAVINGS_ACTION') {
      const { savingsGoalId, mode, amount, walletId, category, note } = body;
      const numAmt = Math.max(0, Number(amount) || 0);
      const goal = await prisma.savingsGoal.findUnique({ where: { id: savingsGoalId } });
      if (!goal) return NextResponse.json({ error: 'Savings goal not found' }, { status: 404 });

      const wallet = walletId ? await prisma.wallet.findUnique({ where: { id: walletId } }) : null;

      if (mode === 'DEPOSIT') {
        await prisma.savingsGoal.update({
          where: { id: goal.id },
          data: { currentBalance: goal.currentBalance + numAmt },
        });
        await prisma.savingsTransaction.create({
          data: {
            type: 'DEPOSIT',
            amount: numAmt,
            note: note?.trim() || 'Added to savings reserve',
            walletName: wallet?.name || null,
            savingsGoalId: goal.id,
          },
        });
      } else if (mode === 'WITHDRAW') {
        const nextBal = Math.max(0, goal.currentBalance - numAmt);
        await prisma.savingsGoal.update({
          where: { id: goal.id },
          data: { currentBalance: nextBal },
        });
        await prisma.savingsTransaction.create({
          data: {
            type: 'WITHDRAW',
            amount: numAmt,
            note:
              note?.trim() ||
              (wallet ? `Released back to ${wallet.name}` : 'Withdrawn from savings'),
            walletName: wallet?.name || null,
            savingsGoalId: goal.id,
          },
        });
      } else if (mode === 'SPEND') {
        const nextBal = Math.max(0, goal.currentBalance - numAmt);
        await prisma.savingsGoal.update({
          where: { id: goal.id },
          data: { currentBalance: nextBal },
        });
        await prisma.savingsTransaction.create({
          data: {
            type: 'SPEND',
            amount: numAmt,
            note: note?.trim() || `Spent from ${goal.name}`,
            walletName: wallet?.name || null,
            savingsGoalId: goal.id,
          },
        });

        if (wallet) {
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: numAmt } },
          });
          await prisma.transaction.create({
            data: {
              type: 'EXPENSE',
              amount: numAmt,
              category: category || 'Savings Spend',
              note: note?.trim() ? `${goal.name}: ${note.trim()}` : `Spent from ${goal.name}`,
              walletId: wallet.id,
            },
          });
        }
      } else if (mode === 'EDIT_BALANCE') {
        await prisma.savingsGoal.update({
          where: { id: goal.id },
          data: { currentBalance: Math.max(0, numAmt) },
        });
        await prisma.savingsTransaction.create({
          data: {
            type: 'EDIT',
            amount: Math.max(0, numAmt),
            note: note?.trim() || `Balance manually adjusted to ৳${Math.max(0, numAmt)}`,
            savingsGoalId: goal.id,
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'DELETE_SAVINGS') {
      const { savingsGoalId } = body;
      await prisma.savingsGoal.delete({ where: { id: savingsGoalId } });
      return NextResponse.json({ success: true });
    }

    // Loans (BORROWED & LENT) + Repayment History
    if (action === 'CREATE_LOAN') {
      const { direction, title, lender, principal, monthlyEmi, reservedAmount, nextDueDate, notes } =
        body;
      const numPrincipal = Number(principal) || 0;
      const numEmi = Number(monthlyEmi) || numPrincipal;
      const numReserved = Number(reservedAmount) || 0;

      const loan = await prisma.loan.create({
        data: {
          userId,
          direction: direction === 'LENT' ? 'LENT' : 'BORROWED',
          title: title.trim(),
          lender: lender?.trim() || null,
          principal: numPrincipal,
          remaining: numPrincipal,
          monthlyEmi: numEmi,
          reservedAmount: numReserved,
          nextDueDate: new Date(nextDueDate),
          notes: notes?.trim() || null,
        },
      });
      return NextResponse.json({ success: true, loan });
    }

    if (action === 'PAY_LOAN') {
      const { loanId, amount, walletId, paymentDate, note } = body;
      const payAmt = Number(amount) || 0;
      if (payAmt <= 0) return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });

      const loan = await prisma.loan.findUnique({ where: { id: loanId } });
      if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

      const nextRemaining = Math.max(0, loan.remaining - payAmt);
      const nextReserved = Math.max(0, loan.reservedAmount - payAmt);
      const isClosed = nextRemaining <= 0.01;
      const nextMonthDue = new Date(new Date(loan.nextDueDate).getTime() + 30 * 24 * 60 * 60 * 1000);
      const wallet = walletId ? await prisma.wallet.findUnique({ where: { id: walletId } }) : null;

      await prisma.loan.update({
        where: { id: loan.id },
        data: {
          remaining: nextRemaining,
          reservedAmount: nextReserved,
          isClosed,
          nextDueDate: isClosed ? loan.nextDueDate : nextMonthDue,
        },
      });

      await prisma.loanPayment.create({
        data: {
          loanId: loan.id,
          amount: payAmt,
          date: paymentDate ? new Date(paymentDate) : new Date(),
          walletName: wallet?.name || null,
          note: note?.trim() || null,
        },
      });

      if (wallet) {
        const isLent = loan.direction === 'LENT';
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: isLent ? { increment: payAmt } : { decrement: payAmt },
          },
        });
        await prisma.transaction.create({
          data: {
            type: isLent ? 'INCOME' : 'EXPENSE',
            amount: payAmt,
            category: isLent ? 'Loan Repaid to Me' : 'Loan EMI',
            note: note?.trim()
              ? `${loan.title} — ${note.trim()}`
              : `${isLent ? 'Loan repayment received' : 'Loan payment'}: ${loan.title}`,
            date: paymentDate ? new Date(paymentDate) : new Date(),
            walletId: wallet.id,
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'DELETE_LOAN') {
      const { loanId } = body;
      await prisma.loan.delete({ where: { id: loanId } });
      return NextResponse.json({ success: true });
    }

    // Purchase Plans
    if (action === 'CREATE_PURCHASE_PLAN') {
      const { title, estimatedCost, savedSoFar, priority, targetDate, notes } = body;
      const plan = await prisma.purchasePlan.create({
        data: {
          userId,
          title: title.trim(),
          estimatedCost: Number(estimatedCost) || 0,
          savedSoFar: Number(savedSoFar) || 0,
          priority: priority || 'MEDIUM',
          targetDate: targetDate ? new Date(targetDate) : null,
          notes: notes?.trim() || null,
        },
      });
      return NextResponse.json({ success: true, plan });
    }

    if (action === 'COMPLETE_PURCHASE_PLAN') {
      const { planId, walletId } = body;
      const plan = await prisma.purchasePlan.findUnique({ where: { id: planId } });
      if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

      await prisma.purchasePlan.update({
        where: { id: plan.id },
        data: { isPurchased: true, savedSoFar: plan.estimatedCost },
      });

      if (walletId && plan.estimatedCost > 0) {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: plan.estimatedCost } },
        });
        await prisma.transaction.create({
          data: {
            type: 'EXPENSE',
            amount: plan.estimatedCost,
            category: 'Planned Purchase',
            note: `Completed planned purchase: ${plan.title}`,
            walletId,
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'DELETE_PURCHASE_PLAN') {
      const { planId } = body;
      await prisma.purchasePlan.delete({ where: { id: planId } });
      return NextResponse.json({ success: true });
    }

    // Custom Categories & User Settings
    if (action === 'CREATE_CATEGORY') {
      const { name, type } = body;
      const cat = await prisma.customCategory.create({
        data: {
          userId,
          name: name.trim(),
          type: type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        },
      });
      return NextResponse.json({ success: true, category: cat });
    }

    if (action === 'UPDATE_SIMULATOR_LIMITS') {
      const safeLimit = Math.max(0, Number(body.dailySafeThreshold) || 200);
      const crazyLimit = Math.max(0, Math.min(safeLimit, Number(body.dailyCrazyThreshold) ?? 50));
      await prisma.userSettings.upsert({
        where: { userId },
        update: {
          dailySafeThreshold: safeLimit,
          dailyCrazyThreshold: crazyLimit,
        },
        create: {
          userId,
          currencySymbol: '৳',
          currencyCode: 'BDT',
          lowBalanceThreshold: 2000,
          enableReminders: true,
          enableBudgetAlerts: true,
          theme: 'LIGHT',
          dailySafeThreshold: safeLimit,
          dailyCrazyThreshold: crazyLimit,
        },
      });
      return NextResponse.json({
        success: true,
        dailySafeThreshold: safeLimit,
        dailyCrazyThreshold: crazyLimit,
      });
    }

    if (action === 'UPDATE_THEME') {
      const normalizedTheme = body.theme === 'DARK' ? 'DARK' : 'LIGHT';
      await prisma.userSettings.upsert({
        where: { userId },
        update: { theme: normalizedTheme },
        create: {
          userId,
          currencySymbol: '৳',
          currencyCode: 'BDT',
          lowBalanceThreshold: 2000,
          enableReminders: true,
          enableBudgetAlerts: true,
          theme: normalizedTheme,
        },
      });
      return NextResponse.json({ success: true, theme: normalizedTheme });
    }

    if (action === 'UPDATE_SETTINGS') {
      const {
        currencySymbol,
        currencyCode,
        lowBalanceThreshold,
        enableReminders,
        enableBudgetAlerts,
        theme,
        dailySafeThreshold,
        dailyCrazyThreshold,
      } = body;
      const normalizedTheme = theme === 'DARK' ? 'DARK' : theme === 'LIGHT' ? 'LIGHT' : undefined;
      await prisma.userSettings.upsert({
        where: { userId },
        update: {
          currencySymbol,
          currencyCode,
          lowBalanceThreshold: Number(lowBalanceThreshold) || 2000,
          enableReminders: Boolean(enableReminders),
          enableBudgetAlerts: Boolean(enableBudgetAlerts),
          ...(normalizedTheme ? { theme: normalizedTheme } : {}),
          ...(dailySafeThreshold !== undefined
            ? { dailySafeThreshold: Math.max(0, Number(dailySafeThreshold) || 200) }
            : {}),
          ...(dailyCrazyThreshold !== undefined
            ? { dailyCrazyThreshold: Math.max(0, Number(dailyCrazyThreshold) ?? 50) }
            : {}),
        },
        create: {
          userId,
          currencySymbol: currencySymbol || '৳',
          currencyCode: currencyCode || 'BDT',
          lowBalanceThreshold: Number(lowBalanceThreshold) || 2000,
          enableReminders: Boolean(enableReminders),
          enableBudgetAlerts: Boolean(enableBudgetAlerts),
          theme: normalizedTheme || 'LIGHT',
        },
      });
      return NextResponse.json({ success: true });
    }

    // Bill Splitter
    if (action === 'BILL_SPLIT') {
      const { title, splitMode, vatAmount, participants, paidByMe, walletId } = body;
      const totalVat = Number(vatAmount) || 0;
      const subtotal = participants.reduce(
        (sum: number, p: { itemTotal: number }) => sum + Number(p.itemTotal),
        0
      );
      const totalAmount = subtotal + totalVat;

      const computedParticipants = participants.map(
        (p: { name: string; isMe: boolean; itemTotal: number }) => {
          const itemCost = Number(p.itemTotal);
          const vatShare = subtotal > 0 ? (itemCost / subtotal) * totalVat : 0;
          const finalOwed = Number((itemCost + vatShare).toFixed(2));
          return {
            name: p.name,
            isMe: Boolean(p.isMe),
            itemTotal: itemCost,
            vatShare: Number(vatShare.toFixed(2)),
            finalOwed,
            isSettled: paidByMe ? Boolean(p.isMe) : !Boolean(p.isMe),
          };
        }
      );

      const split = await prisma.billSplit.create({
        data: {
          userId,
          title,
          subtotal,
          vatAmount: totalVat,
          totalAmount,
          splitMode,
          paidByMe: Boolean(paidByMe),
          participants: {
            create: computedParticipants,
          },
        },
      });

      const myEntry = computedParticipants.find((p: { isMe: boolean }) => p.isMe);
      const myShare = myEntry ? myEntry.finalOwed : totalAmount;

      if (paidByMe && walletId) {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: totalAmount } },
        });

        await prisma.transaction.create({
          data: {
            type: 'EXPENSE',
            amount: myShare,
            category: 'Food',
            note: `${title} (My share incl. VAT; total bill ৳${totalAmount})`,
            walletId,
          },
        });
      } else if (!paidByMe && myShare > 0) {
        await prisma.obligation.create({
          data: {
            userId,
            title: `Split Owed: ${title}`,
            totalAmount: myShare,
            reservedAmount: myShare,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            category: 'SPLIT_OWED',
          },
        });
      }

      return NextResponse.json({ success: true, split });
    }

    if (action === 'SETTLE_SPLIT') {
      const { participantId, walletId } = body;
      const participant = await prisma.splitParticipant.update({
        where: { id: participantId },
        data: { isSettled: true },
        include: { billSplit: true },
      });

      const targetWallet = walletId
        ? await prisma.wallet.findUnique({ where: { id: walletId } })
        : await prisma.wallet.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });

      if (targetWallet) {
        if (participant.billSplit.paidByMe) {
          await prisma.wallet.update({
            where: { id: targetWallet.id },
            data: { balance: { increment: participant.finalOwed } },
          });
          await prisma.transaction.create({
            data: {
              type: 'INCOME',
              amount: participant.finalOwed,
              category: 'Split Settled',
              note: `${participant.name} settled share for ${participant.billSplit.title}`,
              walletId: targetWallet.id,
            },
          });
        } else {
          await prisma.wallet.update({
            where: { id: targetWallet.id },
            data: { balance: { decrement: participant.finalOwed } },
          });
          await prisma.transaction.create({
            data: {
              type: 'EXPENSE',
              amount: participant.finalOwed,
              category: 'Split Paid',
              note: `Paid my split share for ${participant.billSplit.title}`,
              walletId: targetWallet.id,
            },
          });
          const matchingOb = await prisma.obligation.findFirst({
            where: {
              userId,
              title: `Split Owed: ${participant.billSplit.title}`,
              isPaid: false,
            },
          });
          if (matchingOb) {
            await prisma.obligation.update({
              where: { id: matchingOb.id },
              data: { paidAmount: matchingOb.totalAmount, reservedAmount: 0, isPaid: true },
            });
          }
        }
      }

      return NextResponse.json({ success: true, participant });
    }

    // =========================================================================
    // Subscription creation, payment recording, and status toggle handlers
    // =========================================================================
    if (action === 'CREATE_SUBSCRIPTION') {
      const { name, amount, billingCycle, customCycleDays, nextRenewalDate, note } = body;
      const sub = await prisma.subscription.create({
        data: {
          userId,
          name: String(name).trim(),
          amount: Number(amount),
          billingCycle: billingCycle || 'MONTHLY',
          customCycleDays:
            billingCycle === 'CUSTOM' ? Math.max(1, Number(customCycleDays) || 30) : null,
          nextRenewalDate: nextRenewalDate ? new Date(nextRenewalDate) : new Date(),
          status: 'ACTIVE',
          note: note ? String(note).trim() : null,
        },
      });
      return NextResponse.json({ success: true, subscription: sub });
    }

    if (action === 'TOGGLE_SUBSCRIPTION_STATUS') {
      const { subscriptionId, status } = body;
      const updated = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE' },
      });
      return NextResponse.json({ success: true, subscription: updated });
    }

    if (action === 'PAY_SUBSCRIPTION') {
      const { subscriptionId, walletId, amount, paidDate, note } = body;
      const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
      if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });

      const chargeAmt = Number(amount) || sub.amount;
      const txDate = paidDate ? new Date(paidDate) : new Date();

      // Deduct payment from selected wallet and log as an EXPENSE transaction
      if (walletId) {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: chargeAmt } },
        });
        await prisma.transaction.create({
          data: {
            type: 'EXPENSE',
            amount: chargeAmt,
            category: 'Subscriptions',
            note: note ? String(note).trim() : `Subscription payment: ${sub.name}`,
            isRecurring: true,
            date: txDate,
            walletId,
          },
        });
      }

      // Advance nextRenewalDate by one billing cycle
      const baseDate = new Date(sub.nextRenewalDate);
      const nextDate = new Date(baseDate);
      if (sub.billingCycle === 'YEARLY') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      } else if (sub.billingCycle === 'CUSTOM') {
        nextDate.setDate(nextDate.getDate() + Math.max(1, sub.customCycleDays || 30));
      } else {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }

      const updated = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { nextRenewalDate: nextDate },
      });

      return NextResponse.json({ success: true, subscription: updated });
    }

    if (action === 'DELETE_SUBSCRIPTION') {
      const { subscriptionId } = body;
      await prisma.subscription.delete({ where: { id: subscriptionId } });
      return NextResponse.json({ success: true });
    }

    // =========================================================================
    // Investment creation, contribution, withdrawal, and manual valuation update handlers
    // Maintains strict separation between liquid wallet balances and non-liquid
    // investment valuations so paper gains never inflate Available-to-Spend.
    // =========================================================================
    if (action === 'CREATE_INVESTMENT') {
      const { name, assetType, investedAmount, currentValue, startDate, walletId, note } = body;
      const principal = Number(investedAmount) || 0;
      const initialValuation =
        currentValue !== undefined && currentValue !== '' ? Number(currentValue) : principal;
      const invDate = startDate ? new Date(startDate) : new Date();

      if (walletId && principal > 0) {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: principal } },
        });
        await prisma.transaction.create({
          data: {
            type: 'EXPENSE',
            amount: principal,
            category: 'Investment Contribution',
            note: `Initial investment: ${String(name).trim()}`,
            date: invDate,
            walletId,
          },
        });
      }

      const created = await prisma.investment.create({
        data: {
          userId,
          name: String(name).trim(),
          assetType: assetType || 'DPS',
          investedAmount: principal,
          currentValue: initialValuation,
          startDate: invDate,
          note: note ? String(note).trim() : null,
          events: {
            create: {
              eventType: 'INITIAL',
              amount: principal,
              valueAfter: initialValuation,
              note: note ? String(note).trim() : 'Initial investment recorded',
              eventDate: invDate,
            },
          },
        },
      });

      return NextResponse.json({ success: true, investment: created });
    }

    if (action === 'INVESTMENT_CONTRIBUTION') {
      const { investmentId, amount, walletId, eventDate, note } = body;
      const inv = await prisma.investment.findUnique({ where: { id: investmentId } });
      if (!inv) return NextResponse.json({ error: 'Investment not found' }, { status: 404 });

      const delta = Number(amount) || 0;
      const dt = eventDate ? new Date(eventDate) : new Date();
      const newInvested = inv.investedAmount + delta;
      const newValue = inv.currentValue + delta;

      if (walletId && delta > 0) {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: delta } },
        });
        await prisma.transaction.create({
          data: {
            type: 'EXPENSE',
            amount: delta,
            category: 'Investment Contribution',
            note: note ? String(note).trim() : `Contribution to ${inv.name}`,
            date: dt,
            walletId,
          },
        });
      }

      const updated = await prisma.investment.update({
        where: { id: investmentId },
        data: {
          investedAmount: newInvested,
          currentValue: newValue,
          events: {
            create: {
              eventType: 'CONTRIBUTION',
              amount: delta,
              valueAfter: newValue,
              note: note ? String(note).trim() : 'Additional contribution',
              eventDate: dt,
            },
          },
        },
      });

      return NextResponse.json({ success: true, investment: updated });
    }

    if (action === 'INVESTMENT_WITHDRAWAL') {
      const { investmentId, amount, walletId, eventDate, note } = body;
      const inv = await prisma.investment.findUnique({ where: { id: investmentId } });
      if (!inv) return NextResponse.json({ error: 'Investment not found' }, { status: 404 });

      const delta = Number(amount) || 0;
      const dt = eventDate ? new Date(eventDate) : new Date();
      const newInvested = Math.max(0, inv.investedAmount - delta);
      const newValue = Math.max(0, inv.currentValue - delta);

      if (walletId && delta > 0) {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { increment: delta } },
        });
        await prisma.transaction.create({
          data: {
            type: 'INCOME',
            amount: delta,
            category: 'Investment Withdrawal',
            note: note ? String(note).trim() : `Withdrawal from ${inv.name}`,
            date: dt,
            walletId,
          },
        });
      }

      const updated = await prisma.investment.update({
        where: { id: investmentId },
        data: {
          investedAmount: newInvested,
          currentValue: newValue,
          events: {
            create: {
              eventType: 'WITHDRAWAL',
              amount: delta,
              valueAfter: newValue,
              note: note ? String(note).trim() : 'Withdrawal recorded',
              eventDate: dt,
            },
          },
        },
      });

      return NextResponse.json({ success: true, investment: updated });
    }

    if (action === 'UPDATE_INVESTMENT_VALUE') {
      const { investmentId, currentValue, eventDate, note } = body;
      const inv = await prisma.investment.findUnique({ where: { id: investmentId } });
      if (!inv) return NextResponse.json({ error: 'Investment not found' }, { status: 404 });

      const newValue = Number(currentValue) || 0;
      const dt = eventDate ? new Date(eventDate) : new Date();

      // Updates current market/maturity value ONLY; never modifies liquid wallet cash
      const updated = await prisma.investment.update({
        where: { id: investmentId },
        data: {
          currentValue: newValue,
          events: {
            create: {
              eventType: 'VALUATION_UPDATE',
              amount: newValue - inv.currentValue,
              valueAfter: newValue,
              note: note ? String(note).trim() : 'Manual valuation update',
              eventDate: dt,
            },
          },
        },
      });

      return NextResponse.json({ success: true, investment: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Dashboard POST error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
