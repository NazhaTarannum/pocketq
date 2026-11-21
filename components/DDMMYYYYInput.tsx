'use client';

/**
 * @file components/DDMMYYYYInput.tsx
 * @description Controlled text input that accepts dates in DD/MM/YYYY format and emits YYYY-MM-DD ISO strings.
 */

import React, { useEffect, useState } from 'react';

interface DDMMYYYYInputProps {
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

function isoToDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function displayToIso(display: string): string | null {
  const match = display.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const dd = match[1].padStart(2, '0');
  const mm = match[2].padStart(2, '0');
  const yyyy = match[3];
  const dt = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export default function DDMMYYYYInput({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  required = false,
  className = '',
}: DDMMYYYYInputProps) {
  const [text, setText] = useState(() => isoToDisplay(value));

  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  const handleChange = (raw: string) => {
    setText(raw);
    const parsed = displayToIso(raw);
    if (parsed) onChange(parsed);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className={className}
    />
  );
}
