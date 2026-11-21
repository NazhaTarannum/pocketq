/**
 * @file app/api/auth/me/route.ts
 * @description Returns the currently signed-in user's profile summary from the session cookie.
 */

import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user: session });
}
