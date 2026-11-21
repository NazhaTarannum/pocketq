/**
 * @file app/api/wallets/route.ts
 * @description REST API endpoints for creating, updating, and deleting user-owned wallets.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body.name || '').trim();
    const type = String(body.type || 'MFS').trim();
    const balance = Number(body.balance) || 0;

    if (!name) {
      return NextResponse.json({ error: 'Wallet name is required' }, { status: 400 });
    }

    const wallet = await prisma.wallet.create({
      data: {
        userId: session.userId,
        name,
        type,
        balance,
        color: '#7A9E7E',
      },
    });

    return NextResponse.json(wallet, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create wallet';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const id = String(body.id || '').trim();
    const name = String(body.name || '').trim();
    const type = String(body.type || 'MFS').trim();
    const balance = Number(body.balance);

    if (!id || !name || Number.isNaN(balance)) {
      return NextResponse.json({ error: 'Invalid wallet update data' }, { status: 400 });
    }

    const existing = await prisma.wallet.findFirst({
      where: { id, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const updated = await prisma.wallet.update({
      where: { id },
      data: { name, type, balance },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update wallet';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Wallet ID is required' }, { status: 400 });
    }

    const existing = await prisma.wallet.findFirst({
      where: { id, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const count = await prisma.wallet.count({
      where: { userId: session.userId },
    });
    if (count <= 1) {
      return NextResponse.json(
        { error: 'At least one wallet must remain in your account' },
        { status: 400 }
      );
    }

    await prisma.transaction.updateMany({
      where: { targetWalletId: id },
      data: { targetWalletId: null },
    });

    await prisma.wallet.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete wallet';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
