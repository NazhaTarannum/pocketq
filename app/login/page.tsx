'use client';

/**
 * @file app/login/page.tsx
 * @description Sign-in page allowing registered users to access their personal financial workspace.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to sign in');
        return;
      }
      try {
        sessionStorage.removeItem('pocketq_dashboard_cache');
        sessionStorage.removeItem('pocketq_splits_cache');
      } catch {}
      router.push('/');
    } catch {
      setError('Network error while signing in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E8F1F2] text-[#001A23] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white border border-[#7A9E7E]/25 p-7 shadow-sm space-y-6">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#31493C] text-[#B3EFB2]">
            <ShieldCheck className="w-3.5 h-3.5" /> PocketQ
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight pt-1">
            Welcome back
          </h1>
          <p className="text-xs opacity-75">
            Sign in to view your Safe Available-to-Spend, wallets, and forecasts.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-[#D52073]/10 border border-[#D52073]/30 text-xs font-semibold text-[#D52073]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold block">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm border border-[#7A9E7E]/30 outline-none focus:border-[#31493C]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl pl-3.5 pr-10 py-2.5 text-sm border border-[#7A9E7E]/30 outline-none focus:border-[#31493C]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#001A23]/55 hover:text-[#001A23] transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-bold bg-[#31493C] text-[#B3EFB2] hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            {loading ? 'Signing in...' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-xs text-center opacity-80">
          New to PocketQ?{' '}
          <Link href="/register" className="font-bold text-[#31493C] underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
