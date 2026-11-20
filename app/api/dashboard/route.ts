import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

let seedingPromise: Promise<void> | null = null;
async function ensureSeedData() {
  if (seedingPromise) return seedingPromise;
  seedingPromise = (async () => {
    const walletCount = await prisma.wallet.count();
    if (walletCount > 0) return;

    const bkash = await prisma.wallet.create({
      data: { name: 'bKash Personal', type: 'MFS', balance: 6450, color: '#D52073' },
    });
    const bank = await prisma.wallet.create({
      data: { name: 'BRAC Bank Student', type: 'BANK', balance: 18500, color: '#31493C' },
    });
    const cash = await prisma.wallet.create({
      data: { name: 'Cash Wallet', type: 'CASH', balance: 2300, color: '#7A9E7E' },
    });

    await prisma.transaction.createMany({
      data: [
        {
          type: 'INCOME',
          amount: 12000,
          category: 'Private Tuition',
          note: 'HSC Physics batch - November',
          walletId: bank.id,
        },
        {
          type: 'INCOME',
          amount: 6500,
          category: 'Freelance',
          note: 'UI design milestone',
          walletId: bkash.id,
        },
        {
          type: 'EXPENSE',
          amount: 850,
          category: 'Food',
          note: 'Lunch & coffee with friends',
          walletId: cash.id,
        },
        {
          type: 'EXPENSE',
          amount: 1200,
          category: 'Transport',
          note: 'Rickshaw & Metro pass top-up',
          walletId: bkash.id,
        },
      ],
    });

    await prisma.obligation.create({
      data: {
        title: 'University Trimester Fee',
        totalAmount: 30000,
        reservedAmount: 10000,
        paidAmount: 10000,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        category: 'TUITION',
        notes: '3 equal installments per semester',
        installments: {
          create: [
            {
              title: '1st Installment',
              amount: 10000,
              paidAmount: 10000,
              dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
              isPaid: true,
            },
            {
              title: '2nd Installment',
              amount: 10000,
              paidAmount: 0,
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              isPaid: false,
            },
            {
              title: '3rd Installment',
              amount: 10000,
              paidAmount: 0,
              dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
              isPaid: false,
            },
          ],
        },
      },
    });

    await prisma.savingsGoal.create({
      data: {
        name: 'Emergency Funds',
        currentBalance: 5000,
        notes: 'For unexpected medical, repair, or urgent expenses',
        transactions: {
          create: [
            {
              type: 'DEPOSIT',
              amount: 5000,
              note: 'Initial emergency reserve set aside',
            },
          ],
        },
      },
    });

    await prisma.billSplit.create({
      data: {
        title: 'Chillox Burger Night',
        subtotal: 1600,
        vatAmount: 240,
        totalAmount: 1840,
        splitMode: 'ITEMIZED',
        paidByMe: true,
        participants: {
          create: [
            { name: 'Me', isMe: true, itemTotal: 500, vatShare: 75, finalOwed: 575, isSettled: true },
            { name: 'Rafi', isMe: false, itemTotal: 600, vatShare: 90, finalOwed: 690, isSettled: false },
            { name: 'Nusrat', isMe: false, itemTotal: 500, vatShare: 75, finalOwed: 575, isSettled: false },
          ],
        },
      },
    });
  })();
  try {
    await seedingPromise;
  } finally {
    seedingPromise = null;
  }
}

export async function GET() {
  try {
    await ensureSeedData();

    const [wallets, transactions, obligations, savingsGoals, billSplits] = await Promise.all([
      prisma.wallet.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.transaction.findMany({
        include: { wallet: true, targetWallet: true },
        orderBy: { date: 'desc' },
        take: 20,
      }),
      prisma.obligation.findMany({
        include: { installments: { orderBy: { dueDate: 'asc' } } },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.savingsGoal.findMany({
        include: { transactions: { orderBy: { date: 'desc' }, take: 15 } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.billSplit.findMany({
        include: { participants: true },
        orderBy: { date: 'desc' },
        take: 5,
      }),
    ]);

    const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);

    // Reserved for Obligations = money currently set aside for unpaid obligations
    const totalReservedObligations = obligations.reduce(
      (sum, o) => sum + (o.isPaid ? 0 : Math.max(0, o.reservedAmount)),
      0
    );

    // Reserved for Savings = total money currently held across all Savings entries (incl. Emergency Funds)
    const totalReservedSavings = savingsGoals.reduce(
      (sum, s) => sum + Math.max(0, s.currentBalance),
      0
    );

    const totalReserved = totalReservedObligations + totalReservedSavings;

    const owedByFriends = billSplits.reduce((sum, split) => {
      if (!split.paidByMe) return sum;
      const pending = split.participants
        .filter((p) => !p.isMe && !p.isSettled)
        .reduce((pSum, p) => pSum + p.finalOwed, 0);
      return sum + pending;
    }, 0);

    const availableToSpend = totalBalance - totalReserved;

    return NextResponse.json({
      summary: {
        totalBalance,
        totalReserved,
        totalReservedObligations,
        totalReservedSavings,
        availableToSpend,
        owedByFriends,
      },
      wallets,
      transactions,
      obligations,
      savingsGoals,
      billSplits,
    });
  } catch (error) {
    console.error('Dashboard GET error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'TRANSACTION') {
      const { type, amount, category, note, walletId, targetWalletId } = body;
      const numericAmount = Number(amount);

      const tx = await prisma.transaction.create({
        data: {
          type,
          amount: numericAmount,
          category,
          note,
          walletId,
          targetWalletId: type === 'TRANSFER' ? targetWalletId : null,
        },
      });

      if (type === 'INCOME') {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { increment: numericAmount } },
        });
      } else if (type === 'EXPENSE') {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: numericAmount } },
        });
      } else if (type === 'TRANSFER' && targetWalletId) {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: numericAmount } },
        });
        await prisma.wallet.update({
          where: { id: targetWalletId },
          data: { balance: { increment: numericAmount } },
        });
      }

      return NextResponse.json({ success: true, transaction: tx });
    }

    // Create a new Reserved Obligation (with optional multi-installment schedule)
    if (action === 'OBLIGATION') {
      const { title, totalAmount, reservedAmount, dueDate, category, notes, installments } = body;
      const numTotal = Number(totalAmount) || 0;
      const numReserved = Number(reservedAmount) || 0;

      const validInstallments = Array.isArray(installments)
        ? installments.filter((inst: { amount: string | number; dueDate: string }) => Number(inst.amount) > 0 && inst.dueDate)
        : [];

      const obligation = await prisma.obligation.create({
        data: {
          title,
          totalAmount: numTotal,
          reservedAmount: numReserved,
          dueDate: new Date(dueDate),
          category: category || 'OBLIGATION',
          notes: notes || null,
          installments:
            validInstallments.length > 0
              ? {
                  create: validInstallments.map(
                    (inst: { title: string; amount: string | number; dueDate: string }, idx: number) => ({
                      title: inst.title?.trim() || `Installment ${idx + 1}`,
                      amount: Number(inst.amount),
                      dueDate: new Date(inst.dueDate),
                    })
                  ),
                }
              : undefined,
        },
      });
      return NextResponse.json({ success: true, obligation });
    }

    // Manually update reserved money set aside for an obligation (does NOT count as spending)
    if (action === 'RESERVE_OBLIGATION') {
      const { obligationId, amount, mode } = body;
      const numericAmount = Number(amount) || 0;
      const ob = await prisma.obligation.findUnique({ where: { id: obligationId } });
      if (!ob) return NextResponse.json({ error: 'Obligation not found' }, { status: 404 });

      const newReserved =
        mode === 'SET'
          ? Math.max(0, numericAmount)
          : Math.max(0, ob.reservedAmount + numericAmount);

      const updated = await prisma.obligation.update({
        where: { id: obligationId },
        data: { reservedAmount: newReserved },
      });
      return NextResponse.json({ success: true, obligation: updated });
    }

    // Explicit payment confirmation for an obligation or specific installment
    if (action === 'PAY_OBLIGATION') {
      const { obligationId, installmentId, amount, walletId, paymentDate, note } = body;
      const payAmt = Number(amount) || 0;
      if (payAmt <= 0) return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });

      const ob = await prisma.obligation.findUnique({
        where: { id: obligationId },
        include: { installments: true },
      });
      if (!ob) return NextResponse.json({ error: 'Obligation not found' }, { status: 404 });

      let installmentLabel = '';
      if (installmentId) {
        const inst = ob.installments.find((i) => i.id === installmentId);
        if (inst) {
          const newInstPaid = inst.paidAmount + payAmt;
          const instDone = newInstPaid >= inst.amount - 0.01;
          installmentLabel = ` (${inst.title})`;
          await prisma.obligationInstallment.update({
            where: { id: inst.id },
            data: {
              paidAmount: newInstPaid,
              isPaid: instDone,
            },
          });
        }
      }

      const newPaidAmount = ob.paidAmount + payAmt;
      const newReservedAmount = Math.max(0, ob.reservedAmount - payAmt);
      const isFullyPaid = newPaidAmount >= ob.totalAmount - 0.01;

      await prisma.obligation.update({
        where: { id: ob.id },
        data: {
          paidAmount: newPaidAmount,
          reservedAmount: newReservedAmount,
          isPaid: isFullyPaid,
        },
      });

      if (walletId) {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: payAmt } },
        });

        await prisma.transaction.create({
          data: {
            type: 'EXPENSE',
            amount: payAmt,
            category: ob.category || 'Obligation Payment',
            note: note?.trim()
              ? `${ob.title}${installmentLabel} — ${note.trim()}`
              : `Paid ${ob.title}${installmentLabel}`,
            date: paymentDate ? new Date(paymentDate) : new Date(),
            walletId,
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'DELETE_OBLIGATION') {
      const { obligationId } = body;
      await prisma.obligation.delete({ where: { id: obligationId } });
      return NextResponse.json({ success: true });
    }

    // Create a new custom Savings entry (e.g., Japan Trip, New Laptop, Emergency Funds)
    if (action === 'CREATE_SAVINGS') {
      const { name, initialAmount, targetAmount, targetDate, notes } = body;
      const initAmt = Number(initialAmount) || 0;

      const goal = await prisma.savingsGoal.create({
        data: {
          name: name.trim(),
          currentBalance: initAmt,
          targetAmount: targetAmount ? Number(targetAmount) : null,
          targetDate: targetDate ? new Date(targetDate) : null,
          notes: notes?.trim() || null,
          transactions:
            initAmt > 0
              ? {
                  create: [
                    {
                      type: 'DEPOSIT',
                      amount: initAmt,
                      note: 'Initial reserved savings',
                    },
                  ],
                }
              : undefined,
        },
      });
      return NextResponse.json({ success: true, goal });
    }

    // Savings actions: DEPOSIT, WITHDRAW (to wallet, no expense), SPEND (from wallet + logs expense), EDIT_BALANCE
    if (action === 'SAVINGS_ACTION') {
      const { savingsGoalId, mode, amount, walletId, category, note } = body;
      const numAmt = Number(amount) || 0;
      const goal = await prisma.savingsGoal.findUnique({ where: { id: savingsGoalId } });
      if (!goal) return NextResponse.json({ error: 'Savings goal not found' }, { status: 404 });

      const wallet = walletId ? await prisma.wallet.findUnique({ where: { id: walletId } }) : null;

      if (mode === 'DEPOSIT') {
        await prisma.savingsGoal.update({
          where: { id: goal.id },
          data: { currentBalance: goal.currentBalance + numAmt },
        });
        await prisma.savingsTransaction.create({
          data: {
            type: 'DEPOSIT',
            amount: numAmt,
            note: note?.trim() || 'Added to savings reserve',
            walletName: wallet?.name || null,
            savingsGoalId: goal.id,
          },
        });
      } else if (mode === 'WITHDRAW') {
        const nextBal = Math.max(0, goal.currentBalance - numAmt);
        await prisma.savingsGoal.update({
          where: { id: goal.id },
          data: { currentBalance: nextBal },
        });
        await prisma.savingsTransaction.create({
          data: {
            type: 'WITHDRAW',
            amount: numAmt,
            note: note?.trim() || (wallet ? `Released back to ${wallet.name}` : 'Withdrawn from savings'),
            walletName: wallet?.name || null,
            savingsGoalId: goal.id,
          },
        });
      } else if (mode === 'SPEND') {
        const nextBal = Math.max(0, goal.currentBalance - numAmt);
        await prisma.savingsGoal.update({
          where: { id: goal.id },
          data: { currentBalance: nextBal },
        });
        await prisma.savingsTransaction.create({
          data: {
            type: 'SPEND',
            amount: numAmt,
            note: note?.trim() || `Spent from ${goal.name}`,
            walletName: wallet?.name || null,
            savingsGoalId: goal.id,
          },
        });

        if (wallet) {
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: numAmt } },
          });
          await prisma.transaction.create({
            data: {
              type: 'EXPENSE',
              amount: numAmt,
              category: category || 'Savings Spend',
              note: note?.trim() ? `${goal.name}: ${note.trim()}` : `Spent from ${goal.name}`,
              walletId: wallet.id,
            },
          });
        }
      } else if (mode === 'EDIT_BALANCE') {
        await prisma.savingsGoal.update({
          where: { id: goal.id },
          data: { currentBalance: Math.max(0, numAmt) },
        });
        await prisma.savingsTransaction.create({
          data: {
            type: 'EDIT',
            amount: Math.max(0, numAmt),
            note: note?.trim() || `Balance manually adjusted to ৳${Math.max(0, numAmt)}`,
            savingsGoalId: goal.id,
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'DELETE_SAVINGS') {
      const { savingsGoalId } = body;
      await prisma.savingsGoal.delete({ where: { id: savingsGoalId } });
      return NextResponse.json({ success: true });
    }

    if (action === 'BILL_SPLIT') {
      const { title, splitMode, vatAmount, participants, paidByMe, walletId } = body;
      const totalVat = Number(vatAmount) || 0;
      const subtotal = participants.reduce(
        (sum: number, p: { itemTotal: number }) => sum + Number(p.itemTotal),
        0
      );
      const totalAmount = subtotal + totalVat;

      const computedParticipants = participants.map(
        (p: { name: string; isMe: boolean; itemTotal: number }) => {
          const itemCost = Number(p.itemTotal);
          const vatShare = subtotal > 0 ? (itemCost / subtotal) * totalVat : 0;
          const finalOwed = Number((itemCost + vatShare).toFixed(2));
          return {
            name: p.name,
            isMe: Boolean(p.isMe),
            itemTotal: itemCost,
            vatShare: Number(vatShare.toFixed(2)),
            finalOwed,
            isSettled: paidByMe ? Boolean(p.isMe) : !Boolean(p.isMe),
          };
        }
      );

      const split = await prisma.billSplit.create({
        data: {
          title,
          subtotal,
          vatAmount: totalVat,
          totalAmount,
          splitMode,
          paidByMe: Boolean(paidByMe),
          participants: {
            create: computedParticipants,
          },
        },
      });

      const myEntry = computedParticipants.find((p: { isMe: boolean }) => p.isMe);
      const myShare = myEntry ? myEntry.finalOwed : totalAmount;

      if (paidByMe && walletId) {
        await prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { decrement: totalAmount } },
        });

        await prisma.transaction.create({
          data: {
            type: 'EXPENSE',
            amount: myShare,
            category: 'Food',
            note: `${title} (My share incl. VAT; total bill ৳${totalAmount})`,
            walletId,
          },
        });
      } else if (!paidByMe && myShare > 0) {
        await prisma.obligation.create({
          data: {
            title: `Split Owed: ${title}`,
            totalAmount: myShare,
            reservedAmount: myShare,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            category: 'SPLIT_OWED',
          },
        });
      }

      return NextResponse.json({ success: true, split });
    }

    if (action === 'SETTLE_SPLIT') {
      const { participantId, walletId } = body;
      const participant = await prisma.splitParticipant.update({
        where: { id: participantId },
        data: { isSettled: true },
        include: { billSplit: true },
      });

      const targetWallet = walletId
        ? await prisma.wallet.findUnique({ where: { id: walletId } })
        : await prisma.wallet.findFirst({ orderBy: { createdAt: 'asc' } });

      if (targetWallet) {
        if (participant.billSplit.paidByMe) {
          await prisma.wallet.update({
            where: { id: targetWallet.id },
            data: { balance: { increment: participant.finalOwed } },
          });
          await prisma.transaction.create({
            data: {
              type: 'INCOME',
              amount: participant.finalOwed,
              category: 'Split Settled',
              note: `${participant.name} settled share for ${participant.billSplit.title}`,
              walletId: targetWallet.id,
            },
          });
        } else {
          await prisma.wallet.update({
            where: { id: targetWallet.id },
            data: { balance: { decrement: participant.finalOwed } },
          });
          await prisma.transaction.create({
            data: {
              type: 'EXPENSE',
              amount: participant.finalOwed,
              category: 'Split Paid',
              note: `Paid my split share for ${participant.billSplit.title}`,
              walletId: targetWallet.id,
            },
          });
          const matchingOb = await prisma.obligation.findFirst({
            where: {
              title: `Split Owed: ${participant.billSplit.title}`,
              isPaid: false,
            },
          });
          if (matchingOb) {
            await prisma.obligation.update({
              where: { id: matchingOb.id },
              data: { paidAmount: matchingOb.totalAmount, reservedAmount: 0, isPaid: true },
            });
          }
        }
      }

      return NextResponse.json({ success: true, participant });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Dashboard POST error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
