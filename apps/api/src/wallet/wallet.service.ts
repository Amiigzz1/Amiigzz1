import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma, TxType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface WalletSnapshot {
  userId: string;
  coins: bigint;
  diamonds: bigint;
}

export interface MutateInput {
  userId: string;
  type: TxType;
  coinsDelta?: bigint;
  diamondDelta?: bigint;
  /** Idempotency key — reruns with the same (user, type, refId) are no-ops. */
  refId: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string): Promise<WalletSnapshot> {
    const wallet = await this.prisma.wallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return { userId, coins: wallet.coins, diamonds: wallet.diamonds };
  }

  /**
   * Atomically applies a delta to the user's wallet and records the
   * corresponding transaction. Idempotent on (user, type, refId).
   *
   * Throws on insufficient funds; never produces a negative balance.
   */
  async mutate(input: MutateInput): Promise<WalletSnapshot> {
    const coinsDelta = input.coinsDelta ?? 0n;
    const diamondDelta = input.diamondDelta ?? 0n;
    if (coinsDelta === 0n && diamondDelta === 0n) {
      throw new BadRequestException('mutation has no effect');
    }

    return this.prisma.$transaction(async (tx) => {
      // Idempotency check — if we already applied this ref, return the
      // current state without double-charging.
      const existing = await tx.transaction.findUnique({
        where: {
          userId_type_refId: {
            userId: input.userId,
            type: input.type,
            refId: input.refId,
          },
        },
      });
      if (existing) {
        const w = await tx.wallet.findUnique({ where: { userId: input.userId } });
        if (!w) throw new BadRequestException('wallet missing');
        return { userId: input.userId, coins: w.coins, diamonds: w.diamonds };
      }

      const wallet = await tx.wallet.upsert({
        where: { userId: input.userId },
        create: { userId: input.userId },
        update: {},
      });

      const newCoins = wallet.coins + coinsDelta;
      const newDiamonds = wallet.diamonds + diamondDelta;
      if (newCoins < 0n || newDiamonds < 0n) {
        throw new ConflictException('insufficient balance');
      }

      const updated = await tx.wallet.update({
        where: { userId: input.userId },
        data: { coins: newCoins, diamonds: newDiamonds },
      });
      await tx.transaction.create({
        data: {
          userId: input.userId,
          type: input.type,
          coinsDelta,
          diamondDelta,
          refId: input.refId,
          metadata: input.metadata,
        },
      });
      return {
        userId: updated.userId,
        coins: updated.coins,
        diamonds: updated.diamonds,
      };
    });
  }

  /**
   * Apply a set of mutations as a single DB transaction. Used for gift
   * sends (debit sender + credit recipient) and game settlements (debit
   * stakes from all players + credit payout to winner).
   */
  async mutateMany(inputs: MutateInput[]): Promise<WalletSnapshot[]> {
    if (inputs.length === 0) return [];
    return this.prisma.$transaction(async (tx) => {
      const results: WalletSnapshot[] = [];
      for (const input of inputs) {
        const coinsDelta = input.coinsDelta ?? 0n;
        const diamondDelta = input.diamondDelta ?? 0n;
        const existing = await tx.transaction.findUnique({
          where: {
            userId_type_refId: {
              userId: input.userId,
              type: input.type,
              refId: input.refId,
            },
          },
        });
        if (existing) {
          const w = await tx.wallet.findUnique({
            where: { userId: input.userId },
          });
          if (w) results.push({ userId: input.userId, coins: w.coins, diamonds: w.diamonds });
          continue;
        }
        const wallet = await tx.wallet.upsert({
          where: { userId: input.userId },
          create: { userId: input.userId },
          update: {},
        });
        const newCoins = wallet.coins + coinsDelta;
        const newDiamonds = wallet.diamonds + diamondDelta;
        if (newCoins < 0n || newDiamonds < 0n) {
          throw new ConflictException(
            `insufficient balance for user ${input.userId}`,
          );
        }
        const updated = await tx.wallet.update({
          where: { userId: input.userId },
          data: { coins: newCoins, diamonds: newDiamonds },
        });
        await tx.transaction.create({
          data: {
            userId: input.userId,
            type: input.type,
            coinsDelta,
            diamondDelta,
            refId: input.refId,
            metadata: input.metadata,
          },
        });
        results.push({
          userId: updated.userId,
          coins: updated.coins,
          diamonds: updated.diamonds,
        });
      }
      return results;
    });
  }
}

