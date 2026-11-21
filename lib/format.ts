/**
 * @file lib/format.ts
 * @description Shared currency and date formatting utilities for PocketQ.
 */

/**
 * Formats a numeric amount using the active currency symbol and grouping separators.
 */
export function formatCurrency(amount: number, symbol = '৳'): string {
  return `${symbol}${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Formats an ISO date string into DD/MM/YYYY display format.
 */
export function formatDateDDMMYYYY(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
