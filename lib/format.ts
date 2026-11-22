/**
 * @file lib/format.ts
 * @description Shared decimal-safe currency formatting, FX conversion, and date utilities for PocketQ.
 */

export const FX_RATES_FROM_BDT: Record<string, { symbol: string; name: string; rateFromBDT: number }> = {
  BDT: { symbol: '৳', name: 'Bangladeshi Taka', rateFromBDT: 1 },
  USD: { symbol: '$', name: 'US Dollar', rateFromBDT: 1 / 119.5 },
  EUR: { symbol: '€', name: 'Euro', rateFromBDT: 1 / 129.0 },
  GBP: { symbol: '£', name: 'British Pound', rateFromBDT: 1 / 151.0 },
  INR: { symbol: '₹', name: 'Indian Rupee', rateFromBDT: 1 / 1.42 },
  AED: { symbol: 'د.إ', name: 'UAE Dirham', rateFromBDT: 1 / 32.5 },
  SAR: { symbol: '﷼', name: 'Saudi Riyal', rateFromBDT: 1 / 31.8 },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', rateFromBDT: 1 / 86.5 },
  AUD: { symbol: 'A$', name: 'Australian Dollar', rateFromBDT: 1 / 78.0 },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', rateFromBDT: 1 / 88.5 },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit', rateFromBDT: 1 / 26.8 },
  JPY: { symbol: '¥', name: 'Japanese Yen', rateFromBDT: 1 / 0.78 },
};

/**
 * Rounds a number to exact 2 decimal places using integer-cent precision.
 */
export function roundMoney(amount: number): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Converts an amount from baseCode into targetCode using relative FX rates.
 */
export function convertCurrencyAmount(
  amount: number,
  baseCode = 'BDT',
  targetCode = 'BDT'
): number {
  const clean = roundMoney(amount);
  if (!targetCode || baseCode === targetCode) return clean;
  const fromRate = FX_RATES_FROM_BDT[baseCode]?.rateFromBDT ?? 1;
  const toRate = FX_RATES_FROM_BDT[targetCode]?.rateFromBDT ?? 1;
  if (fromRate <= 0) return clean;
  const inBdt = clean / fromRate;
  return roundMoney(inBdt * toRate);
}

/**
 * Formats a numeric amount with exact two decimal places and grouping separators.
 */
export function formatCurrency(amount: number, symbol = '৳'): string {
  const safe = roundMoney(amount);
  const isNeg = safe < 0;
  const abs = Math.abs(safe);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNeg ? '-' : ''}${symbol}${formatted}`;
}

/**
 * Formats an ISO date string into DD/MM/YYYY display format.
 */
export function formatDateDDMMYYYY(iso?: string | null): string {
  if (!iso) return 'No deadline';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'No deadline';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
