'use client';

/**
 * @file app/admin/page.tsx
 * @description Admin login and user directory workspace for inspecting registered users and deleting profiles.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sun,
  Moon,
  ShieldAlert,
  Trash2,
  Search,
  Lock,
  Users,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import { useThemePreference } from '@/lib/useThemePreference';

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  counts: {
    wallets: number;
    transactions: number;
    obligations: number;
    savingsGoals: number;
    billSplits: number;
    subscriptions: number;
    investments: number;
  };
}

export default function AdminPortalPage() {
  const [darkMode, setDarkMode] = useThemePreference();
  const [authState, setAuthState] = useState<'CHECKING' | 'LOGIN_REQUIRED' | 'AUTHORIZED'>('CHECKING');
  const [adminUser, setAdminUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState('');

  // Admin Login Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadAdminUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.status === 401 || res.status === 403) {
        setAuthState('LOGIN_REQUIRED');
        return;
      }
      const data = await res.json();
      if (res.ok && Array.isArray(data.users)) {
        setAdminUser(data.admin || null);
        setUsers(data.users);
        setAuthState('AUTHORIZED');
      } else {
        setAuthState('LOGIN_REQUIRED');
      }
    } catch {
      setAuthState('LOGIN_REQUIRED');
    }
  };

  useEffect(() => {
    loadAdminUsers();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Invalid credentials.');
        return;
      }
      if (!data.user?.isAdmin) {
        setLoginError('Access denied: This account does not have administrator privileges.');
        return;
      }
      try {
        sessionStorage.removeItem('pocketq_dashboard_cache');
        sessionStorage.removeItem('pocketq_splits_cache');
      } catch {}
      await loadAdminUsers();
    } catch {
      setLoginError('Unable to verify admin credentials.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Could not delete user profile.' });
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
        setFeedback({
          type: 'ok',
          text: `Deleted profile for ${deleteTarget.name} (${deleteTarget.email}) and all associated records.`,
        });
      }
    } catch {
      setFeedback({ type: 'err', text: 'Network error while deleting user profile.' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const cardClass = darkMode
    ? 'bg-[#08100D] border-[#31493C] text-[#E8F1F2]'
    : 'bg-white border-[#7A9E7E]/30 text-[#001A23]';

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        darkMode ? 'bg-black text-[#E8F1F2]' : 'bg-[#E8F1F2] text-[#001A23]'
      }`}
    >
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md ${
          darkMode ? 'bg-black/90 border-[#31493C]' : 'bg-[#E8F1F2]/90 border-[#7A9E7E]/30'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <AppSidebar darkMode={darkMode} />
            <Link
              href="/"
              title="Back to Dashboard"
              className={`p-2 rounded-xl border transition shrink-0 ${
                darkMode
                  ? 'bg-[#31493C]/50 border-[#31493C] hover:bg-[#31493C]'
                  : 'bg-white border-[#7A9E7E]/30 hover:bg-[#7A9E7E]/10'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="font-extrabold text-sm sm:text-base tracking-tight truncate">
              Admin Portal
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            aria-label="Toggle color theme"
            className={`p-2 rounded-xl border transition cursor-pointer shrink-0 ${
              darkMode
                ? 'bg-[#31493C]/50 border-[#31493C] text-[#FFEF5C]'
                : 'bg-white border-[#7A9E7E]/30 text-[#001A23]'
            }`}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {authState !== 'AUTHORIZED' ? (
          <div className="max-w-md mx-auto mt-10">
            <form
              onSubmit={handleAdminLogin}
              className={`p-6 rounded-3xl border shadow-lg space-y-4 ${cardClass}`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#D52073]/15 text-[#D52073] flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold">Administrator Sign-In</h2>
                  <p className="text-xs opacity-65">Restricted user directory & profile control</p>
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-[#D52073]/15 border border-[#D52073]/40 text-xs font-semibold text-[#D52073]">
                  {loginError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold block mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#7A9E7E]/40 bg-transparent text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#7A9E7E]/40 bg-transparent text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-2.5 rounded-xl text-xs font-extrabold bg-[#31493C] text-[#B3EFB2] hover:opacity-90 transition cursor-pointer disabled:opacity-50"
              >
                {loggingIn ? 'Verifying...' : 'Sign In as Admin'}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-5">
            {feedback && (
              <div
                className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
                  feedback.type === 'ok'
                    ? 'bg-[#31493C]/20 border-[#7A9E7E]/50 text-[#31493C] dark:text-[#B3EFB2]'
                    : 'bg-[#D52073]/15 border-[#D52073]/40 text-[#D52073]'
                }`}
              >
                {feedback.type === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            {/* Platform Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={`p-4 rounded-2xl border ${cardClass}`}>
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-65">
                  Registered Users
                </span>
                <p className="text-2xl font-extrabold mt-1">{users.length}</p>
              </div>
              <div className={`p-4 rounded-2xl border ${cardClass}`}>
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-65">
                  Total Wallets
                </span>
                <p className="text-2xl font-extrabold mt-1">
                  {users.reduce((s, u) => s + u.counts.wallets, 0)}
                </p>
              </div>
              <div className={`p-4 rounded-2xl border ${cardClass}`}>
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-65">
                  Total Transactions
                </span>
                <p className="text-2xl font-extrabold mt-1">
                  {users.reduce((s, u) => s + u.counts.transactions, 0)}
                </p>
              </div>
              <div className={`p-4 rounded-2xl border ${cardClass}`}>
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-65">
                  Total Split Bills
                </span>
                <p className="text-2xl font-extrabold mt-1">
                  {users.reduce((s, u) => s + u.counts.billSplits, 0)}
                </p>
              </div>
            </div>

            {/* Search & Directory */}
            <div className={`p-4 sm:p-5 rounded-3xl border space-y-4 ${cardClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#7A9E7E]" />
                  <h2 className="text-sm font-extrabold">
                    All Registered Profiles ({filteredUsers.length})
                  </h2>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by name or email..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#7A9E7E]/40 bg-transparent text-xs"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#7A9E7E]/25 opacity-70">
                      <th className="py-2.5 px-3 font-bold">User</th>
                      <th className="py-2.5 px-3 font-bold">Role</th>
                      <th className="py-2.5 px-3 font-bold">Joined</th>
                      <th className="py-2.5 px-3 font-bold">Wallets</th>
                      <th className="py-2.5 px-3 font-bold">Txns</th>
                      <th className="py-2.5 px-3 font-bold">Splits</th>
                      <th className="py-2.5 px-3 font-bold">Obligations</th>
                      <th className="py-2.5 px-3 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#7A9E7E]/15">
                    {filteredUsers.map((u) => {
                      const d = new Date(u.createdAt);
                      const dateLabel = isNaN(d.getTime())
                        ? '-'
                        : `${String(d.getDate()).padStart(2, '0')}/${String(
                            d.getMonth() + 1
                          ).padStart(2, '0')}/${d.getFullYear()}`;
                      const isSelf = adminUser?.id === u.id;

                      return (
                        <tr key={u.id} className="hover:bg-[#7A9E7E]/5">
                          <td className="py-3 px-3">
                            <span className="font-bold block">{u.name}</span>
                            <span className="text-[11px] opacity-65">{u.email}</span>
                          </td>
                          <td className="py-3 px-3">
                            {u.isAdmin ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#31493C] text-[#B3EFB2]">
                                ADMIN
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7A9E7E]/15 opacity-80">
                                USER
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 opacity-80">{dateLabel}</td>
                          <td className="py-3 px-3 font-semibold">{u.counts.wallets}</td>
                          <td className="py-3 px-3 font-semibold">{u.counts.transactions}</td>
                          <td className="py-3 px-3 font-semibold">{u.counts.billSplits}</td>
                          <td className="py-3 px-3 font-semibold">{u.counts.obligations}</td>
                          <td className="py-3 px-3 text-right">
                            {isSelf ? (
                              <span className="text-[11px] opacity-55 font-semibold">
                                Current Admin
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(u)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-[#D52073]/40 text-[#D52073] hover:bg-[#D52073]/10 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Delete Profile Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className={`w-full max-w-md p-5 rounded-3xl border shadow-2xl space-y-4 ${cardClass}`}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#D52073]/15 text-[#D52073] flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold">Delete User Profile?</h3>
                <p className="text-xs opacity-75 mt-1">
                  This will permanently remove <strong>{deleteTarget.name}</strong> ({deleteTarget.email})
                  and cascade-delete all their wallets, transactions, obligations, savings, splits,
                  subscriptions, and investments. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-[#7A9E7E]/40 hover:bg-[#7A9E7E]/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#D52073] text-white hover:opacity-90 cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
