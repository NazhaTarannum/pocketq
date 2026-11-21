/**
 * @file app/api/admin/users/route.ts
 * @description Server-verified admin endpoint returning all registered users and summary record counts.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession, isAdminEmail } from '@/lib/auth';

async function requireAdmin() {
  const session = await getCurrentSession();
  if (!session) return null;
  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, isAdmin: true },
  });
  if (!currentUser) return null;
  if (!currentUser.isAdmin && !isAdminEmail(currentUser.email)) {
    return null;
  }
  return currentUser;
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
        createdAt: true,
        _count: {
          select: {
            wallets: true,
            obligations: true,
            savingsGoals: true,
            billSplits: true,
            subscriptions: true,
            investments: true,
          },
        },
        wallets: {
          select: {
            _count: {
              select: { transactions: true },
            },
          },
        },
      },
    });

    const formatted = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isAdmin: Boolean(u.isAdmin || isAdminEmail(u.email)),
      createdAt: u.createdAt,
      counts: {
        wallets: u._count.wallets,
        transactions: u.wallets.reduce((sum, w) => sum + w._count.transactions, 0),
        obligations: u._count.obligations,
        savingsGoals: u._count.savingsGoals,
        billSplits: u._count.billSplits,
        subscriptions: u._count.subscriptions,
        investments: u._count.investments,
      },
    }));

    return NextResponse.json({ admin: { id: admin.id, email: admin.email, name: admin.name }, users: formatted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load users';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
