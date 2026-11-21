/**
 * @file app/api/auth/login/route.ts
 * @description Authenticates an existing user with email and password and issues an HTTP-only session cookie.
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE_NAME, signSessionToken, isAdminEmail } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const adminFlag = Boolean(user.isAdmin || isAdminEmail(user.email));
    if (adminFlag && !user.isAdmin) {
      await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } }).catch(() => {});
    }

    const token = await signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      isAdmin: adminFlag,
    });

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, isAdmin: adminFlag },
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
