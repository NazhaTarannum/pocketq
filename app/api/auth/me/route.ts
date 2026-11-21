/**
 * @file app/api/auth/me/route.ts
 * @description Returns the currently signed-in user's profile summary from the session cookie.
 */

import { NextResponse } from 'next/server';
import { getCurrentSession, isAdminEmail } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, isAdmin: true },
  });
  if (!dbUser) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const adminFlag = Boolean(dbUser.isAdmin || isAdminEmail(dbUser.email));
  return NextResponse.json({
    user: {
      userId: dbUser.id,
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      isAdmin: adminFlag,
    },
  });
}
