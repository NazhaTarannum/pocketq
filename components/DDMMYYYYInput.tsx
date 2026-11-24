'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DDMMYYYYInputProps {
  value: string; // YYYY-MM-DD
  onChange: (isoDate: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function displayToIso(display: string): string {
  const digits = display.replace(/\D/g, '');
  if (digits.length !== 8) return '';
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  const d = Number(dd);
  const m = Number(mm);
  const y = Number(yyyy);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return '';
  return `${yyyy}-${mm}-${dd}`;
}

function parseIsoParts(iso: string): { year: number; month: number; day: number } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]) - 1,
    day: Number(m[3]),
  };
}

function toIsoDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export default function DDMMYYYYInput({
  value,
  onChange,
  required,
  className = '',
  placeholder = 'dd/mm/yyyy',
}: DDMMYYYYInputProps) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(
    () => toIsoDate(today.getFullYear(), today.getMonth(), today.getDate()),
    [today]
  );

  const initialParts = parseIsoParts(value);
  const [viewYear, setViewYear] = useState<number>(
    initialParts ? initialParts.year : today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(
    initialParts ? initialParts.month : today.getMonth()
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setText(isoToDisplay(value));
    const parsed = parseIsoParts(value);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [value]);

  const computeCoords = () => {
    if (typeof document !== 'undefined') {
      setIsDark(document.documentElement.classList.contains('dark'));
    }
    const el = wrapperRef.current;
    if (!el || typeof window === 'undefined') return null;
    const rect = el.getBoundingClientRect();
    const popoverWidth = Math.min(276, window.innerWidth - 24);
    const popoverHeight = 312;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < popoverHeight && rect.top > popoverHeight;

    const top = openAbove
      ? Math.max(12, rect.top - popoverHeight - 6)
      : Math.min(window.innerHeight - popoverHeight - 12, rect.bottom + 6);

    const left = Math.min(
      Math.max(12, rect.left),
      Math.max(12, window.innerWidth - popoverWidth - 12)
    );

    const next = { top, left, width: popoverWidth };
    setCoords(next);
    return next;
  };

  useLayoutEffect(() => {
    if (open) {
      computeCoords();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    const handleReposition = () => computeCoords();

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open]);

  const handleOpen = () => {
    computeCoords();
    setOpen(true);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
    let formatted = raw;
    if (raw.length > 4) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}`;
    } else if (raw.length > 2) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }
    setText(formatted);
    if (raw.length === 8) {
      const iso = displayToIso(formatted);
      if (iso) onChange(iso);
    } else if (raw.length === 0) {
      onChange('');
    }
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{
      key: string;
      day: number;
      iso: string;
      inCurrentMonth: boolean;
    }> = [];

    for (let i = firstWeekday - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({
        key: `prev-${d}`,
        day: d,
        iso: toIsoDate(prevY, prevM, d),
        inCurrentMonth: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        key: `curr-${d}`,
        day: d,
        iso: toIsoDate(viewYear, viewMonth, d),
        inCurrentMonth: true,
      });
    }

    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({
        key: `next-${d}`,
        day: d,
        iso: toIsoDate(nextY, nextM, d),
        inCurrentMonth: false,
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const handleSelectIso = (iso: string) => {
    onChange(iso);
    setText(isoToDisplay(iso));
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative flex items-center w-full min-w-0">
      <input
        type="text"
        inputMode="numeric"
        required={required}
        value={text}
        onFocus={handleOpen}
        onClick={handleOpen}
        onChange={handleTextChange}
        placeholder={placeholder}
        maxLength={10}
        className={`${className} w-full min-w-0 pr-9 text-[#001A23] dark:text-[#E8F1F2] placeholder:text-[#001A23]/45 dark:placeholder:text-[#E8F1F2]/45 accent-[#001A23]`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open calendar"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            handleOpen();
          }
        }}
        className="absolute right-2.5 text-[#001A23] dark:text-[#E8F1F2] opacity-70 hover:opacity-100 cursor-pointer bg-transparent border-0 p-0"
      >
        <Calendar className="w-4 h-4" />
      </button>

      {mounted &&
        open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Choose date"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
              backdropFilter: 'blur(26px) saturate(190%)',
              WebkitBackdropFilter: 'blur(26px) saturate(190%)',
            }}
            className={`pq-calendar-popover p-3.5 select-none ${
              isDark ? 'pq-cal-dark text-[#E8F1F2]' : 'pq-cal-light text-[#001A23]'
            }`}
          >
            {/* Header: Month / Year + Navigation */}
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-sm font-extrabold tracking-tight">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <div className="flex items-center gap-1">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handlePrevMonth}
                  onKeyDown={(e) => e.key === 'Enter' && handlePrevMonth()}
                  aria-label="Previous month"
                  className="pq-cal-nav-btn w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setViewYear(today.getFullYear());
                    setViewMonth(today.getMonth());
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setViewYear(today.getFullYear());
                      setViewMonth(today.getMonth());
                    }
                  }}
                  aria-label="Jump to current month"
                  title="Current month"
                  className={`w-2 h-2 rounded-full mx-1 transition-transform hover:scale-125 cursor-pointer ${
                    isDark ? 'bg-[#3EE895]/85' : 'bg-[#0A8F4C]/85'
                  }`}
                />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleNextMonth}
                  onKeyDown={(e) => e.key === 'Enter' && handleNextMonth()}
                  aria-label="Next month"
                  className="pq-cal-nav-btn w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Weekday Labels */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1.5 pb-1 border-b border-current/10">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-[11px] font-bold opacity-55">
                  {w}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {calendarCells.map((cell) => {
                const isSelected = value === cell.iso;
                const isToday = todayIso === cell.iso;

                return (
                  <div
                    key={cell.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectIso(cell.iso)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSelectIso(cell.iso)}
                    className={`pq-cal-day h-8 rounded-full text-xs cursor-pointer flex items-center justify-center transition-all ${
                      isSelected
                        ? 'pq-cal-selected font-extrabold'
                        : isToday
                        ? 'pq-cal-today font-extrabold'
                        : cell.inCurrentMonth
                        ? 'pq-cal-in-month font-medium'
                        : 'opacity-35 hover:opacity-70'
                    }`}
                  >
                    {cell.day}
                  </div>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-current/10 px-1 text-[11px] font-bold">
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleSelectIso(todayIso)}
                onKeyDown={(e) => e.key === 'Enter' && handleSelectIso(todayIso)}
                className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                  isDark
                    ? 'text-[#3EE895] hover:bg-[#3EE895]/15'
                    : 'text-[#0A8F4C] hover:bg-white/60'
                }`}
              >
                Today
              </div>
              {value && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onChange('');
                    setText('');
                    setOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onChange('');
                      setText('');
                      setOpen(false);
                    }
                  }}
                  className="px-2.5 py-1 rounded-full opacity-65 hover:opacity-100 transition-opacity cursor-pointer"
                >
                  Clear
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
