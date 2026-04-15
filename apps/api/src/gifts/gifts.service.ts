import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TxType } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

export interface GiftCatalogEntry {
  id: string;
  nameAr: string;
  nameEn: string;
  priceCoins: bigint;
  animationUrl: string | null;
  category: string;
}

export interface SendGiftInput {
  senderId: string;
  recipientId: string;
  giftId: string;
  roomId?: string;
  quantity: number;
}

export interface SendGiftResult {
  giftSendId: string;
  totalCoins: bigint;
  totalDiamonds: bigint;
  sender: { coins: bigint; diamonds: bigint };
  recipient: { coins: bigint; diamonds: bigint };
}

/**
 * Majlis's creator economics
 * --------------------------
 * Gifts cost coins on the sender side and credit diamonds to the
 * recipient at a **50% rate** (1 coin = 0.5 diamonds). That's the
 * differentiating number vs. competitors at 20–30%. At withdrawal time,
 * `DIAMOND_TO_USD_CENTS` converts diamonds to fiat.
 *
 * Example (falafel gift, 120 coins):
 *   sender debited: 120 coins
 *   recipient credited: 60 diamonds (= $0.60 at the current peg)
 */
@Injectable()
export class GiftsService {
  /** Creator payout rate: 50 diamonds per 100 coins of gift value. */
  static readonly DIAMOND_PAYOUT_BPS = 5000; // basis points (10_000 = 100%)
  /** Peg used on Phase 4 withdrawals. 1 diamond = $0.01 (=1 cent). */
  static readonly DIAMOND_TO_USD_CENTS = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async listCatalog(): Promise<GiftCatalogEntry[]> {
    const rows = await this.prisma.giftCatalog.findMany({
      where: { active: true },
      orderBy: [{ priceCoins: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      priceCoins: row.priceCoins,
      animationUrl: row.animationUrl,
      category: row.category,
    }));
  }

  async send(input: SendGiftInput): Promise<SendGiftResult> {
    if (input.senderId === input.recipientId) {
      throw new ForbiddenException('cannot gift yourself');
    }
    if (input.quantity < 1 || input.quantity > 99) {
      throw new BadRequestException('quantity must be between 1 and 99');
    }

    const gift = await this.prisma.giftCatalog.findUnique({
      where: { id: input.giftId },
    });
    if (!gift || !gift.active) {
      throw new NotFoundException('gift not found');
    }

    const totalCoins = gift.priceCoins * BigInt(input.quantity);
    const totalDiamonds =
      (totalCoins * BigInt(GiftsService.DIAMOND_PAYOUT_BPS)) / 10_000n;

    // Single deterministic ref id for this gift event — reused across both
    // wallet mutations so an API retry doesn't double-charge.
    const refId = randomUUID();

    try {
      const mutations = await this.wallet.mutateMany([
        {
          userId: input.senderId,
          type: TxType.gift_sent,
          coinsDelta: -totalCoins,
          refId,
          metadata: {
            giftId: input.giftId,
            recipientId: input.recipientId,
            roomId: input.roomId ?? null,
            quantity: input.quantity,
          },
        },
        {
          userId: input.recipientId,
          type: TxType.gift_received,
          diamondDelta: totalDiamonds,
          refId,
          metadata: {
            giftId: input.giftId,
            senderId: input.senderId,
            roomId: input.roomId ?? null,
            quantity: input.quantity,
          },
        },
      ]);

      const giftSend = await this.prisma.giftSend.create({
        data: {
          giftId: input.giftId,
          senderId: input.senderId,
          recipientId: input.recipientId,
          roomId: input.roomId,
          quantity: input.quantity,
          totalCoins,
          totalDiamonds,
        },
      });

      const [sender, recipient] = mutations;
      return {
        giftSendId: giftSend.id,
        totalCoins,
        totalDiamonds,
        sender: { coins: sender.coins, diamonds: sender.diamonds },
        recipient: { coins: recipient.coins, diamonds: recipient.diamonds },
      };
    } catch (err) {
      if (err instanceof ConflictException) {
        throw new ConflictException('insufficient coins');
      }
      throw err;
    }
  }
}
