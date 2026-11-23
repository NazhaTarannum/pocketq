'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

interface DDMMYYYYInputProps {
  value: string; // YYYY-MM-DD
  onChange: (isoDate: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

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

export default function DDMMYYYYInput({
  value,
  onChange,
  required,
  className = '',
  placeholder = 'dd/mm/yyyy',
}: DDMMYYYYInputProps) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const nativePickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

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

  return (
    <div className="relative flex items-center w-full min-w-0 overflow-hidden">
      <input
        type="text"
        inputMode="numeric"
        required={required}
        value={text}
        onChange={handleTextChange}
        placeholder={placeholder}
        maxLength={10}
        className={`${className} w-full min-w-0 pr-9 text-[#001A23] dark:text-[#E8F1F2] placeholder:text-[#001A23]/45 dark:placeholder:text-[#E8F1F2]/45 accent-[#001A23]`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open calendar"
        onClick={() => {
          const el = nativePickerRef.current;
          if (!el) return;
          if (typeof el.showPicker === 'function') {
            el.showPicker();
          } else {
            el.focus();
            el.click();
          }
        }}
        className="absolute right-2.5 text-[#001A23] dark:text-[#E8F1F2] opacity-70 hover:opacity-100 cursor-pointer bg-transparent border-0 p-0"
      >
        <Calendar className="w-4 h-4" />
      </button>
      <input
        ref={nativePickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
    </div>
  );
}
