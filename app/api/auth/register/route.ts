/**
 * @file app/api/auth/register/route.ts
 * @description Creates a new user account, initializes default settings and starter wallets, and sets an authenticated session cookie.
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE_NAME, signSessionToken } from '@/lib/auth';

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

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
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
    });

    const token = await signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const res = NextResponse.json(
      { user: { id: user.id, name: user.name, email: user.email } },
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
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
