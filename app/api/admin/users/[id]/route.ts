/**
 * @file app/api/admin/users/[id]/route.ts
 * @description Server-verified admin endpoint to permanently delete a user profile and cascade all user data.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession, isAdminEmail } from '@/lib/auth';

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, isAdmin: true },
    });

    if (!admin || (!admin.isAdmin && !isAdminEmail(admin.email))) {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    if (id === admin.id) {
      return NextResponse.json(
        { error: 'Safety guard: You cannot delete your own active admin account.' },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!target) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Cascade deletes all wallets, transactions, obligations, savings, loans, splits, subscriptions, and investments
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ deleted: true, id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete user';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
