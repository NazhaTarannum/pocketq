export type BillingFrequency =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'YEARLY'
  | 'CUSTOM';

export type CustomIntervalUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

export type CycleDisplayStatus =
  | 'UPCOMING'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'PAID'
  | 'CANCELLED';

export interface RecurrenceConfig {
  startDate: Date | string;
  billingCycle: BillingFrequency | string;
  customIntervalValue?: number | null;
  customIntervalUnit?: CustomIntervalUnit | string | null;
  customCycleDays?: number | null;
}

/**
 * Parse a YYYY-MM-DD or ISO date string into a calendar-normalized UTC noon Date
 * so local timezone offsets never shift a due date across midnight boundaries.
 */
export function normalizeCalendarDate(input: Date | string): Date {
  if (input instanceof Date) {
    return new Date(
      Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate(), 12, 0, 0, 0)
    );
  }
  const str = String(input).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (match) {
    return new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0)
    );
  }
  const parsed = new Date(str);
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12, 0, 0, 0)
  );
}

/**
 * Format a Date to YYYY-MM-DD in calendar UTC coordinates.
 */
export function toISODateString(date: Date | string): string {
  const d = normalizeCalendarDate(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Days in a given month (0-indexed month) in UTC.
 */
function daysInMonthUTC(year: number, monthZeroIndexed: number): number {
  return new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
}

/**
 * Add N months while clamping to the last valid day of the target month
 * AND preserving the original anchor day (e.g. Jan 31 + 1m -> Feb 28; Jan 31 + 2m -> Mar 31).
 */
export function addMonthsAnchored(anchorDate: Date, monthsToAdd: number): Date {
  const anchor = normalizeCalendarDate(anchorDate);
  const anchorDay = anchor.getUTCDate();
  const totalMonths = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const maxDay = daysInMonthUTC(targetYear, targetMonth);
  const clampedDay = Math.min(anchorDay, maxDay);
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay, 12, 0, 0, 0));
}

/**
 * Add N days in calendar UTC.
 */
export function addDaysUTC(baseDate: Date, daysToAdd: number): Date {
  const d = normalizeCalendarDate(baseDate);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysToAdd, 12, 0, 0, 0)
  );
}

/**
 * Resolve normalized interval unit & step count for any BillingFrequency.
 */
export function resolveIntervalSpec(config: RecurrenceConfig): {
  unit: CustomIntervalUnit;
  step: number;
} {
  const cycle = String(config.billingCycle || 'MONTHLY').toUpperCase();
  switch (cycle) {
    case 'WEEKLY':
      return { unit: 'WEEKS', step: 1 };
    case 'MONTHLY':
      return { unit: 'MONTHS', step: 1 };
    case 'QUARTERLY':
      return { unit: 'MONTHS', step: 3 };
    case 'HALF_YEARLY':
      return { unit: 'MONTHS', step: 6 };
    case 'YEARLY':
      return { unit: 'YEARS', step: 1 };
    case 'CUSTOM': {
      const unitRaw = String(config.customIntervalUnit || '').toUpperCase();
      if (
        (unitRaw === 'DAYS' || unitRaw === 'WEEKS' || unitRaw === 'MONTHS' || unitRaw === 'YEARS') &&
        config.customIntervalValue &&
        config.customIntervalValue >= 1
      ) {
        return {
          unit: unitRaw as CustomIntervalUnit,
          step: Math.max(1, Math.floor(Number(config.customIntervalValue))),
        };
      }
      // Backward compatibility with legacy customCycleDays
      return {
        unit: 'DAYS',
        step: Math.max(1, Math.floor(Number(config.customCycleDays || 30))),
      };
    }
    default:
      return { unit: 'MONTHS', step: 1 };
  }
}

/**
 * Compute the K-th billing date from startDate (k = 1 gives the first renewal after startDate).
 * Using k cycles from anchor startDate prevents month-end drift (Jan 31 -> Feb 28 -> Mar 31).
 */
export function computeCycleDateFromAnchor(config: RecurrenceConfig, cycleIndex: number): Date {
  const anchor = normalizeCalendarDate(config.startDate);
  const { unit, step } = resolveIntervalSpec(config);
  const totalSteps = step * cycleIndex;

  if (unit === 'DAYS') {
    return addDaysUTC(anchor, totalSteps);
  }
  if (unit === 'WEEKS') {
    return addDaysUTC(anchor, totalSteps * 7);
  }
  if (unit === 'MONTHS') {
    return addMonthsAnchored(anchor, totalSteps);
  }
  // YEARS
  return addMonthsAnchored(anchor, totalSteps * 12);
}

/**
 * Given an anchor startDate and the current dueDate, advance to the very next billing cycle.
 * Finds the matching cycle index from anchor so end-of-month anchor days stay preserved.
 */
export function calculateNextDueDate(
  config: RecurrenceConfig,
  currentDueDate: Date | string
): Date {
  const anchor = normalizeCalendarDate(config.startDate);
  const current = normalizeCalendarDate(currentDueDate);

  // If current due date is before anchor, first renewal is cycle 1
  if (current.getTime() < anchor.getTime()) {
    return computeCycleDateFromAnchor(config, 1);
  }

  // Walk cycles from anchor until we pass currentDueDate (guarantees anchor-day preservation)
  for (let k = 1; k <= 600; k++) {
    const candidate = computeCycleDateFromAnchor(config, k);
    if (candidate.getTime() > current.getTime()) {
      return candidate;
    }
  }

  // Fallback for ultra-long histories (> 600 cycles)
  return computeCycleDateFromAnchor({ ...config, startDate: current }, 1);
}

/**
 * Generate the next `count` upcoming billing dates starting from `nextDueDate`.
 */
export function generateUpcomingSchedule(
  config: RecurrenceConfig,
  nextDueDate: Date | string,
  count = 5
): string[] {
  const schedule: string[] = [];
  let cursor = normalizeCalendarDate(nextDueDate);
  for (let i = 0; i < count; i++) {
    schedule.push(toISODateString(cursor));
    cursor = calculateNextDueDate(config, cursor);
  }
  return schedule;
}

/**
 * Difference in whole calendar days: (targetDate - referenceToday).
 * Positive = future, 0 = due today, Negative = overdue.
 */
export function calendarDayDiff(targetDate: Date | string, referenceToday?: Date | string): number {
  const target = normalizeCalendarDate(targetDate);
  const today = referenceToday
    ? normalizeCalendarDate(referenceToday)
    : normalizeCalendarDate(new Date());
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

/**
 * Strict payment eligibility check:
 * - Cancelled subscriptions can NEVER be settled.
 * - Future bills (daysUntilDue > 0) can NEVER be settled.
 * - Bills due today (daysUntilDue === 0) or overdue (daysUntilDue < 0) CAN be settled.
 */
export function evaluateSubscriptionStatus(params: {
  status: string;
  nextRenewalDate: Date | string;
  lastPaidDate?: Date | string | null;
  referenceToday?: Date | string;
}): {
  displayStatus: CycleDisplayStatus;
  daysUntilDue: number;
  canSettle: boolean;
  blockReason: string | null;
} {
  if (params.status === 'CANCELLED') {
    return {
      displayStatus: 'CANCELLED',
      daysUntilDue: calendarDayDiff(params.nextRenewalDate, params.referenceToday),
      canSettle: false,
      blockReason: 'This subscription is cancelled and does not generate payable bills.',
    };
  }

  const daysUntilDue = calendarDayDiff(params.nextRenewalDate, params.referenceToday);

  if (daysUntilDue < 0) {
    return {
      displayStatus: 'OVERDUE',
      daysUntilDue,
      canSettle: true,
      blockReason: null,
    };
  }

  if (daysUntilDue === 0) {
    return {
      displayStatus: 'DUE_TODAY',
      daysUntilDue: 0,
      canSettle: true,
      blockReason: null,
    };
  }

  // daysUntilDue > 0 -> Future bill
  const wasRecentlyPaid = Boolean(params.lastPaidDate);
  return {
    displayStatus: wasRecentlyPaid ? 'PAID' : 'UPCOMING',
    daysUntilDue,
    canSettle: false,
    blockReason: `Future bill cannot be settled early. Available on ${toISODateString(params.nextRenewalDate)}.`,
  };
}

/**
 * Human-readable billing frequency label.
 */
export function formatFrequencyLabel(config: RecurrenceConfig): string {
  const cycle = String(config.billingCycle || 'MONTHLY').toUpperCase();
  switch (cycle) {
    case 'WEEKLY':
      return 'Weekly';
    case 'MONTHLY':
      return 'Monthly';
    case 'QUARTERLY':
      return 'Quarterly (Every 3 Months)';
    case 'HALF_YEARLY':
      return 'Half-Yearly (Every 6 Months)';
    case 'YEARLY':
      return 'Yearly (Every 12 Months)';
    case 'CUSTOM': {
      const { unit, step } = resolveIntervalSpec(config);
      const unitLabel =
        unit === 'DAYS'
          ? step === 1 ? 'Day' : 'Days'
          : unit === 'WEEKS'
            ? step === 1 ? 'Week' : 'Weeks'
            : unit === 'MONTHS'
              ? step === 1 ? 'Month' : 'Months'
              : step === 1 ? 'Year' : 'Years';
      return `Every ${step} ${unitLabel}`;
    }
    default:
      return 'Monthly';
  }
}

/**
 * Normalized monthly & yearly burn rate equivalents.
 */
export function computeNormalizedCosts(
  amount: number,
  config: RecurrenceConfig
): { monthlyEquivalent: number; yearlyEquivalent: number } {
  const { unit, step } = resolveIntervalSpec(config);
  let cyclesPerYear = 12;

  if (unit === 'DAYS') {
    cyclesPerYear = 365 / step;
  } else if (unit === 'WEEKS') {
    cyclesPerYear = 52 / step;
  } else if (unit === 'MONTHS') {
    cyclesPerYear = 12 / step;
  } else if (unit === 'YEARS') {
    cyclesPerYear = 1 / step;
  }

  const yearlyEquivalent = Number((amount * cyclesPerYear).toFixed(2));
  const monthlyEquivalent = Number((yearlyEquivalent / 12).toFixed(2));
  return { monthlyEquivalent, yearlyEquivalent };
}
