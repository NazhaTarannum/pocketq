import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const type = String(body.type || 'MFS').trim();
    const balance = Number(body.balance) || 0;

    if (!name) {
      return NextResponse.json({ error: 'Wallet name is required' }, { status: 400 });
    }

    const wallet = await prisma.wallet.create({
      data: {
        name,
        type,
        balance,
        color: '#7A9E7E',
      },
    });

    return NextResponse.json(wallet, { status: 201 });
  } catch (error: any) {
    console.error('Wallet POST error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create wallet' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = String(body.id || '').trim();
    const name = String(body.name || '').trim();
    const type = String(body.type || 'MFS').trim();
    const balance = Number(body.balance);

    if (!id || !name || Number.isNaN(balance)) {
      return NextResponse.json({ error: 'Invalid wallet update data' }, { status: 400 });
    }

    const updated = await prisma.wallet.update({
      where: { id },
      data: { name, type, balance },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Wallet PATCH error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update wallet' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Wallet ID is required' }, { status: 400 });
    }

    const count = await prisma.wallet.count();
    if (count <= 1) {
      return NextResponse.json(
        { error: 'At least one wallet must remain in PocketQ' },
        { status: 400 }
      );
    }

    await prisma.transaction.updateMany({
      where: { targetWalletId: id },
      data: { targetWalletId: null },
    });

    await prisma.wallet.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Wallet DELETE error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete wallet' },
      { status: 500 }
    );
  }
}
