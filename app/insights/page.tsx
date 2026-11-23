'use client';

import AppHeader from '@/components/AppHeader';

import { formatCurrency } from '@/lib/format';

/**
 * @file app/insights/page.tsx
 * @description Calendar timeline, cash-flow analytics, and 30/60/90-day scenario forecasting workspace.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sun,
  Moon,
  Bell,
  Calendar,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import { useThemePreference } from '@/lib/useThemePreference';

interface ForecastPoint {
  days: number;
  label: string;
  projectedAvailable: number;
  projectedLoanRemaining: number;
  projectedSavings: number;
  isHealthy: boolean;
}

interface InsightsData {
  settings?: { currencySymbol?: string; currencyCode?: string };
  plannerContext: {
    scenarios: {
      OPTIMISTIC: ForecastPoint[];
      EXPECTED: ForecastPoint[];
      CONSERVATIVE: ForecastPoint[];
    };
  };
  reports: {
    monthlySeries: Array<{ month: string; income: number; expense: number }>;
    yearlyIncome: number;
    yearlyExpenses: number;
    yearlyNet: number;
  };
  calendarEvents: Array<{
    id: string;
    date: string;
    title: string;
    amount: number;
    kind: 'OBLIGATION' | 'EXPECTED_INCOME' | 'LOAN' | 'RECURRING_EXPENSE';
    status: string;
  }>;
  notifications: Array<{
    id: string;
    severity: 'WARNING' | 'INFO' | 'POSITIVE';
    title: string;
    message: string;
  }>;
}

const EMPTY_INSIGHTS_DATA: InsightsData = {
  plannerContext: {
    scenarios: {
      OPTIMISTIC: [],
      EXPECTED: [],
      CONSERVATIVE: [],
    },
  },
  reports: {
    monthlySeries: [],
    yearlyIncome: 0,
    yearlyExpenses: 0,
    yearlyNet: 0,
  },
  calendarEvents: [],
  notifications: [],
};

export default function InsightsAndCalendarPage() {
  const [data, setData] = useState<InsightsData>(EMPTY_INSIGHTS_DATA);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useThemePreference();
  const [scenario, setScenario] = useState<'OPTIMISTIC' | 'EXPECTED' | 'CONSERVATIVE'>('EXPECTED');

  const currencySymbol = data?.settings?.currencySymbol || '৳';
  const formatBDT = (num: number) => formatCurrency(num, currencySymbol);
  const formatDateDDMMYYYY = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}/${d.getFullYear()}`;
  };

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('pocketq_dashboard_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.reports) setData(parsed);
      }
    } catch {}

    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((json) => {
        if (json && json.reports) { setData(json); try { sessionStorage.setItem('pocketq_dashboard_cache', JSON.stringify(json)); } catch {} }
      })
      .finally(() => setLoading(false));
  }, []);

  const activeForecast = data.plannerContext.scenarios[scenario] || [];
  const maxBar = Math.max(
    1,
    ...data.reports.monthlySeries.map((m) => Math.max(m.income, m.expense))
  );

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        darkMode ? 'bg-black text-[#E8F1F2]' : 'bg-[#E8F1F2] text-[#001A23]'
      }`}
    >
      <AppHeader darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} />

      <main className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-5 sm:space-y-6">
        {/* Smart Notifications Feed */}
        <section
          className={`rounded-3xl p-5 border ${
            darkMode
              ? 'bg-[#31493C]/20 border-[#31493C]'
              : 'bg-white border-[#7A9E7E]/25 shadow-sm'
          }`}
        >
          <h2 className="font-bold text-base flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-[#D52073]" />
            Smart Notifications & Early Warnings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
                  n.severity === 'WARNING'
                    ? 'bg-[#D52073]/10 border-[#D52073]/30'
                    : n.severity === 'POSITIVE'
                    ? 'bg-[#B3EFB2]/20 border-[#7A9E7E]/30'
                    : 'bg-[#7A9E7E]/10 border-[#7A9E7E]/25'
                }`}
              >
                {n.severity === 'WARNING' ? (
                  <AlertTriangle className="w-4 h-4 text-[#D52073] shrink-0 mt-0.5" />
                ) : n.severity === 'POSITIVE' ? (
                  <CheckCircle2 className="w-4 h-4 text-[#7A9E7E] shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-[#7A9E7E] shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold block">{n.title}</span>
                  <p className="opacity-80 mt-0.5 leading-relaxed">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3-Scenario Cash Flow Forecast & Financial Calendar */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 3-Scenario Forecast (7 cols) */}
          <div
            className={`lg:col-span-7 rounded-3xl p-5 border ${
              darkMode
                ? 'bg-[#31493C]/20 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-sm'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="font-bold text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#7A9E7E]" />
                  3-Scenario Cash Flow Forecast
                </h2>
                <p className="text-xs opacity-75">
                  Compare Optimistic, Expected, and Conservative trajectories over 90 days
                </p>
              </div>
              <div className="flex gap-1 p-1 rounded-full bg-[#7A9E7E]/15 text-xs font-bold">
                {(['OPTIMISTIC', 'EXPECTED', 'CONSERVATIVE'] as const).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => setScenario(sc)}
                    className={`px-2.5 py-1 rounded-full cursor-pointer ${
                      scenario === sc ? 'bg-[#31493C] text-[#B3EFB2]' : 'opacity-75'
                    }`}
                  >
                    {sc.charAt(0) + sc.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {activeForecast.map((pt) => (
                <div
                  key={pt.days}
                  className={`p-4 rounded-2xl border ${
                    darkMode
                      ? 'bg-[#001A23]/50 border-[#31493C]'
                      : 'bg-[#E8F1F2]/50 border-[#7A9E7E]/20'
                  }`}
                >
                  <span className="text-xs font-extrabold uppercase text-[#7A9E7E] block mb-2">
                    In {pt.label}
                  </span>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="opacity-65 block">Projected Available</span>
                      <span
                        className={`text-base font-extrabold ${
                          pt.isHealthy ? '' : 'text-[#D52073]'
                        }`}
                      >
                        {formatBDT(pt.projectedAvailable)}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-65 block">Savings Held</span>
                      <span className="font-bold text-[#7A9E7E]">
                        {formatBDT(pt.projectedSavings)}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-65 block">Loan Remaining</span>
                      <span className="font-bold">{formatBDT(pt.projectedLoanRemaining)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Calendar (5 cols) */}
          <div
            className={`lg:col-span-5 rounded-3xl p-5 border ${
              darkMode
                ? 'bg-[#31493C]/20 border-[#31493C]'
                : 'bg-white border-[#7A9E7E]/25 shadow-sm'
            }`}
          >
            <h2 className="font-bold text-base flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-[#D52073]" />
              Financial Calendar & Deadlines
            </h2>
            <p className="text-xs opacity-75 mb-4">
              Upcoming obligations, expected income dates, and loan repayments
            </p>

            {data.calendarEvents.length === 0 ? (
              <p className="text-xs opacity-65 py-6 text-center">No upcoming scheduled events.</p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {data.calendarEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-2 text-xs ${
                      darkMode
                        ? 'bg-[#001A23]/50 border-[#31493C]'
                        : 'bg-[#E8F1F2]/50 border-[#7A9E7E]/20'
                    }`}
                  >
                    <div>
                      <span className="font-bold block">{ev.title}</span>
                      <span className="opacity-70 text-[11px]">
                        {formatDateDDMMYYYY(ev.date)} • {ev.status}
                      </span>
                    </div>
                    <span
                      className={`font-extrabold ${
                        ev.kind === 'EXPECTED_INCOME' ? 'text-[#7A9E7E]' : ''
                      }`}
                    >
                      {ev.kind === 'EXPECTED_INCOME' ? '+' : ''}
                      {formatBDT(ev.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Monthly & Yearly Financial Reports */}
        <section
          className={`rounded-3xl p-5 border ${
            darkMode
              ? 'bg-[#31493C]/20 border-[#31493C]'
              : 'bg-white border-[#7A9E7E]/25 shadow-sm'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-bold text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#7A9E7E]" />
                Monthly & Yearly Financial Reports
              </h2>
              <p className="text-xs opacity-75">
                6-month Income vs. Expense comparison and 12-month summary
              </p>
            </div>
            <div className="flex gap-4 text-xs">
              <div>
                <span className="opacity-65 block">Yearly Income</span>
                <strong className="text-sm text-[#7A9E7E]">
                  {formatBDT(data.reports.yearlyIncome)}
                </strong>
              </div>
              <div>
                <span className="opacity-65 block">Yearly Expenses</span>
                <strong className="text-sm text-[#D52073]">
                  {formatBDT(data.reports.yearlyExpenses)}
                </strong>
              </div>
              <div>
                <span className="opacity-65 block">Net Yearly</span>
                <strong className="text-sm">{formatBDT(data.reports.yearlyNet)}</strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-2">
            {data.reports.monthlySeries.map((m) => (
              <div
                key={m.month}
                className="p-3 rounded-2xl border border-[#7A9E7E]/20 flex flex-col justify-between"
              >
                <span className="text-xs font-bold mb-2">{m.month}</span>
                <div className="h-24 flex items-end gap-2 mb-2">
                  <div
                    className="flex-1 bg-[#7A9E7E] rounded-t-md transition-all"
                    style={{ height: `${Math.max(6, Math.round((m.income / maxBar) * 100))}%` }}
                    title={`Income: ${formatBDT(m.income)}`}
                  />
                  <div
                    className="flex-1 bg-[#D52073] rounded-t-md transition-all"
                    style={{ height: `${Math.max(6, Math.round((m.expense / maxBar) * 100))}%` }}
                    title={`Expense: ${formatBDT(m.expense)}`}
                  />
                </div>
                <div className="text-[10px] space-y-0.5 opacity-80">
                  <div className="text-[#7A9E7E] font-bold">In: {formatBDT(m.income)}</div>
                  <div className="text-[#D52073] font-bold">Out: {formatBDT(m.expense)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
