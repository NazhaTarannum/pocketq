'use client';

/**
 * @file components/DDMMYYYYInput.tsx
 * @description Reliable cross-platform calendar/date-picker input with DD/MM/YYYY preview and timezone-safe YYYY-MM-DD emission.
 */

import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';

interface DDMMYYYYInputProps {
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

function normalizeIsoDate(raw: string): string {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DDMMYYYYInput({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  required = false,
  className = '',
}: DDMMYYYYInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalized = normalizeIsoDate(value);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    if (typeof (el as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
      try {
        (el as HTMLInputElement & { showPicker: () => void }).showPicker();
        return;
      } catch {}
    }
    el.focus();
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        ref={inputRef}
        type="date"
        value={normalized}
        required={required}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent outline-none text-inherit pr-6 cursor-pointer"
      />
      <button
        type="button"
        onClick={openPicker}
        tabIndex={-1}
        aria-label="Open calendar"
        className="absolute right-2 opacity-65 hover:opacity-100 cursor-pointer"
      >
        <Calendar className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
