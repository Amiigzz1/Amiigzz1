import { ConflictException } from '@nestjs/common';
import { TxType } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';

/**
 * Minimal in-memory Prisma double that covers the slice of the client
 * WalletService actually touches: wallet.upsert/update/findUnique,
 * transaction.findUnique/create, and $transaction pass-through.
 */
function makePrisma(): PrismaService {
  const wallets = new Map<string, { coins: bigint; diamonds: bigint }>();
  const txs: Array<{ userId: string; type: TxType; refId: string }> = [];

  const api = {
    wallet: {
      upsert: jest.fn(async (args: any) => {
        const { userId } = args.where;
        if (!wallets.has(userId)) {
          wallets.set(userId, { coins: 0n, diamonds: 0n });
        }
        const w = wallets.get(userId)!;
        return { userId, ...w, updatedAt: new Date() };
      }),
      update: jest.fn(async (args: any) => {
        const { userId } = args.where;
        const w = wallets.get(userId)!;
        const next = { ...w, ...args.data };
        wallets.set(userId, next);
        return { userId, ...next, updatedAt: new Date() };
      }),
      findUnique: jest.fn(async (args: any) => {
        const { userId } = args.where;
        if (!wallets.has(userId)) return null;
        const w = wallets.get(userId)!;
        return { userId, ...w, updatedAt: new Date() };
      }),
    },
    transaction: {
      findUnique: jest.fn(async (args: any) => {
        const { userId, type, refId } = args.where.userId_type_refId;
        return txs.find(
          (t) => t.userId === userId && t.type === type && t.refId === refId,
        );
      }),
      create: jest.fn(async (args: any) => {
        txs.push({
          userId: args.data.userId,
          type: args.data.type,
          refId: args.data.refId,
        });
        return args.data;
      }),
    },
    $transaction: jest.fn(async (arg: any) => {
      if (typeof arg === 'function') return arg(api);
      return arg;
    }),
  } as unknown as PrismaService;

  return api;
}

describe('WalletService.mutate', () => {
  it('credits coins atomically', async () => {
    const p = makePrisma();
    const svc = new WalletService(p);
    const snap = await svc.mutate({
      userId: 'u1',
      type: TxType.admin_adjust,
      coinsDelta: 500n,
      refId: 'seed-1',
    });
    expect(snap.coins).toBe(500n);
  });

  it('rejects mutations with no effect', async () => {
    const svc = new WalletService(makePrisma());
    await expect(
      svc.mutate({ userId: 'u1', type: TxType.admin_adjust, refId: 'x' }),
    ).rejects.toThrow();
  });

  it('rejects insufficient balance', async () => {
    const svc = new WalletService(makePrisma());
    await expect(
      svc.mutate({
        userId: 'u1',
        type: TxType.game_stake,
        coinsDelta: -100n,
        refId: 'stake-1',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('is idempotent on (user, type, refId)', async () => {
    const p = makePrisma();
    const svc = new WalletService(p);

    // Seed balance first.
    await svc.mutate({
      userId: 'u1',
      type: TxType.admin_adjust,
      coinsDelta: 1_000n,
      refId: 'seed',
    });

    const a = await svc.mutate({
      userId: 'u1',
      type: TxType.game_stake,
      coinsDelta: -100n,
      refId: 'round-1',
    });
    const b = await svc.mutate({
      userId: 'u1',
      type: TxType.game_stake,
      coinsDelta: -100n,
      refId: 'round-1',
    });
    expect(a.coins).toBe(900n);
    expect(b.coins).toBe(900n); // replay returns current state, no double-charge
  });
});

describe('WalletService.mutateMany', () => {
  it('applies all mutations atomically', async () => {
    const p = makePrisma();
    const svc = new WalletService(p);
    await svc.mutate({
      userId: 'sender',
      type: TxType.admin_adjust,
      coinsDelta: 1_000n,
      refId: 'seed',
    });

    const results = await svc.mutateMany([
      {
        userId: 'sender',
        type: TxType.gift_sent,
        coinsDelta: -200n,
        refId: 'gift-42',
      },
      {
        userId: 'recipient',
        type: TxType.gift_received,
        diamondDelta: 100n,
        refId: 'gift-42',
      },
    ]);

    expect(results[0].coins).toBe(800n);
    expect(results[1].diamonds).toBe(100n);
  });
});
