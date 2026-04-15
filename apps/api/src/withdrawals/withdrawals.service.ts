import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TxType, WithdrawalStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

export interface RequestWithdrawalInput {
  userId: string;
  diamonds: bigint;
  method: string;
  methodDetails: Prisma.InputJsonValue;
}

/**
 * WithdrawalsService
 * ------------------
 * Creator cashout flow.
 *
 *   1. `request`: debits diamonds from the user, records a pending row.
 *   2. Admin reviews in the Next.js dashboard (Phase 5).
 *   3. `approve` / `reject`: on reject, diamonds are refunded atomically.
 *      On approve, diamonds stay debited; the ops team completes the
 *      external transfer and `markPaid` flips status to `paid`.
 *
 * Policies:
 *   - Minimum payout: 5000 diamonds (~$50 at the current peg).
 *   - One pending withdrawal per user at a time (prevents double-dip).
 */
@Injectable()
export class WithdrawalsService {
  static readonly MIN_DIAMONDS = 5_000n;
  static readonly DIAMOND_TO_USD_CENTS = 1n;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async request(
    input: RequestWithdrawalInput,
  ): Promise<{ id: string; amountUsd: string; status: WithdrawalStatus }> {
    if (input.diamonds < WithdrawalsService.MIN_DIAMONDS) {
      throw new BadRequestException(
        `minimum withdrawal is ${WithdrawalsService.MIN_DIAMONDS} diamonds`,
      );
    }
    // Prevent a user from queueing multiple requests concurrently.
    const existing = await this.prisma.withdrawal.findFirst({
      where: { userId: input.userId, status: WithdrawalStatus.pending },
    });
    if (existing) {
      throw new ConflictException('you already have a pending withdrawal');
    }

    const amountCents =
      input.diamonds * WithdrawalsService.DIAMOND_TO_USD_CENTS;
    const amountUsd = (Number(amountCents) / 100).toFixed(2);

    return this.prisma.$transaction(async (tx) => {
      // Debit diamonds first — fail loudly on insufficient balance.
      try {
        await this.wallet.mutate({
          userId: input.userId,
          type: TxType.withdrawal,
          diamondDelta: -input.diamonds,
          refId: `withdrawal-request-${Date.now()}-${input.userId}`,
          metadata: { method: input.method },
        });
      } catch (err) {
        if (err instanceof ConflictException) {
          throw new ConflictException('insufficient diamonds');
        }
        throw err;
      }

      const row = await tx.withdrawal.create({
        data: {
          userId: input.userId,
          diamonds: input.diamonds,
          amountUsd,
          method: input.method,
          methodDetails: input.methodDetails,
        },
      });
      return { id: row.id, amountUsd, status: row.status };
    });
  }

  async listForUser(userId: string): Promise<
    Array<{
      id: string;
      diamonds: string;
      amountUsd: string;
      method: string;
      status: WithdrawalStatus;
      requestedAt: string;
    }>
  > {
    const rows = await this.prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      diamonds: r.diamonds.toString(),
      amountUsd: r.amountUsd.toString(),
      method: r.method,
      status: r.status,
      requestedAt: r.requestedAt.toISOString(),
    }));
  }

  /** Admin: approve → moves to "approved"; the ops team completes payout. */
  async approve(reviewerId: string, withdrawalId: string): Promise<void> {
    await this.prisma.withdrawal.update({
      where: { id: withdrawalId, status: WithdrawalStatus.pending },
      data: {
        status: WithdrawalStatus.approved,
        reviewerId,
        reviewedAt: new Date(),
      },
    });
  }

  /** Admin: reject → refund diamonds and record the reason. */
  async reject(
    reviewerId: string,
    withdrawalId: string,
    reason: string,
  ): Promise<void> {
    const row = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!row) throw new NotFoundException('withdrawal not found');
    if (row.status !== WithdrawalStatus.pending) {
      throw new ForbiddenException('only pending withdrawals can be rejected');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: WithdrawalStatus.rejected,
          reviewerId,
          reason,
          reviewedAt: new Date(),
        },
      });
      await this.wallet.mutate({
        userId: row.userId,
        type: TxType.admin_adjust,
        diamondDelta: row.diamonds,
        refId: `withdrawal-refund-${row.id}`,
        metadata: { reason: 'withdrawal rejected', withdrawalId: row.id },
      });
    });
  }

  async markPaid(reviewerId: string, withdrawalId: string): Promise<void> {
    await this.prisma.withdrawal.update({
      where: { id: withdrawalId, status: WithdrawalStatus.approved },
      data: {
        status: WithdrawalStatus.paid,
        reviewerId,
        reviewedAt: new Date(),
      },
    });
  }
}
