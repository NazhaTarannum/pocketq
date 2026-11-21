/**
 * @file app/api/auth/register/route.ts
 * @description Fast single-roundtrip user registration with starter wallets, settings, and pre-warmed dashboard state.
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE_NAME, signSessionToken, isAdminEmail } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!name || !email || password.length < 6) {
      return NextResponse.json(
        { error: 'Name, valid email, and a password of at least 6 characters are required.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 8);
    const adminFlag = isAdminEmail(email);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        isAdmin: adminFlag,
        settings: {
          create: {
            currencySymbol: '৳',
            currencyCode: 'BDT',
            lowBalanceThreshold: 2000,
            enableReminders: true,
            enableBudgetAlerts: true,
          },
        },
        wallets: {
          create: [
            { name: 'Cash Wallet', type: 'CASH', balance: 0, color: '#7A9E7E' },
            { name: 'Bank Account', type: 'BANK', balance: 0, color: '#31493C' },
            { name: 'MFS Wallet', type: 'MFS', balance: 0, color: '#D52073' },
          ],
        },
      },
      include: {
        wallets: true,
        settings: true,
      },
    });

    const token = await signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      isAdmin: adminFlag,
    });

    const initialDashboard = {
      summary: {
        totalBalance: 0,
        totalReserved: 0,
        totalReservedObligations: 0,
        totalReservedSavings: 0,
        availableToSpend: 0,
        owedByFriends: 0,
      },
      wallets: user.wallets,
      transactions: [],
      obligations: [],
      savingsGoals: [],
      billSplits: [],
      settings: user.settings,
    };

    const res = NextResponse.json(
      {
        user: { id: user.id, name: user.name, email: user.email, isAdmin: adminFlag },
        initialDashboard,
      },
      { status: 201 }
    );

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
