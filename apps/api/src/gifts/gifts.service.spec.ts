import { ConflictException, ForbiddenException } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';
import type { WalletService } from '../wallet/wallet.service';
import { GiftsService } from './gifts.service';

function makePrisma(overrides: Partial<{ giftId: string; price: bigint; active: boolean }> = {}) {
  const gift = {
    id: overrides.giftId ?? 'falafel',
    nameAr: 'فلافل',
    nameEn: 'Falafel',
    priceCoins: overrides.price ?? 120n,
    animationUrl: null,
    category: 'regional',
    active: overrides.active ?? true,
    createdAt: new Date(),
  };
  return {
    giftCatalog: {
      findUnique: jest.fn().mockResolvedValue(gift),
      findMany: jest.fn().mockResolvedValue([gift]),
    },
    giftSend: {
      create: jest.fn(async (args: any) => ({
        id: 'gs-1',
        ...args.data,
        createdAt: new Date(),
      })),
    },
  } as unknown as PrismaService;
}

function makeWallet(result?: { senderCoins?: bigint; recipientDiamonds?: bigint }): WalletService {
  return {
    mutateMany: jest.fn().mockResolvedValue([
      { userId: 'sender', coins: result?.senderCoins ?? 880n, diamonds: 0n },
      { userId: 'recipient', coins: 0n, diamonds: result?.recipientDiamonds ?? 60n },
    ]),
  } as unknown as WalletService;
}

describe('GiftsService.send', () => {
  it('applies a 50/50 diamond payout', async () => {
    const prisma = makePrisma({ price: 120n });
    const wallet = makeWallet({ senderCoins: 880n, recipientDiamonds: 60n });
    const svc = new GiftsService(prisma, wallet);

    const result = await svc.send({
      senderId: 'sender',
      recipientId: 'recipient',
      giftId: 'falafel',
      quantity: 1,
    });

    expect(result.totalCoins).toBe(120n);
    expect(result.totalDiamonds).toBe(60n);
    expect((wallet.mutateMany as jest.Mock).mock.calls[0][0]).toMatchObject([
      { userId: 'sender', coinsDelta: -120n },
      { userId: 'recipient', diamondDelta: 60n },
    ]);
  });

  it('multiplies by quantity', async () => {
    const prisma = makePrisma({ price: 100n });
    const wallet = makeWallet();
    const svc = new GiftsService(prisma, wallet);
    const result = await svc.send({
      senderId: 'sender',
      recipientId: 'recipient',
      giftId: 'rose',
      quantity: 5,
    });
    expect(result.totalCoins).toBe(500n);
    expect(result.totalDiamonds).toBe(250n);
  });

  it('blocks self-gifting', async () => {
    const svc = new GiftsService(makePrisma(), makeWallet());
    await expect(
      svc.send({
        senderId: 'same',
        recipientId: 'same',
        giftId: 'rose',
        quantity: 1,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('maps insufficient funds to a helpful error', async () => {
    const prisma = makePrisma();
    const wallet = {
      mutateMany: jest.fn().mockRejectedValue(new ConflictException('insufficient')),
    } as unknown as WalletService;
    const svc = new GiftsService(prisma, wallet);
    await expect(
      svc.send({
        senderId: 'sender',
        recipientId: 'recipient',
        giftId: 'rose',
        quantity: 1,
      }),
    ).rejects.toThrow('insufficient coins');
  });
});
