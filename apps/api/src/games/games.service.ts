import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { GameKind, TxType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { WalletService } from '../wallet/wallet.service';

/**
 * Coin economics
 * --------------
 * - Entry stake per player: LUDO_STAKE coins (default 100).
 * - Payout to the winner: LUDO_PAYOUT coins (default 380) when the engine
 *   declares them.
 * - House rake: 4 * STAKE - PAYOUT = 20 coins for a 400-coin pot.
 *
 * TODO(phase-4): expose stake tiers via /games/config.
 */
@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  static readonly LUDO_STAKE = 100n;
  static readonly LUDO_PAYOUT = 380n;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly realtime: RealtimeService,
  ) {}

  async quickMatchLudo(
    userId: string,
  ): Promise<{ gameId: string; roomUrl: string; state: unknown }> {
    // Charge the stake up front. If matchmaking fails we refund below.
    const stakeRefId = `ludo-pending-${userId}-${Date.now()}`;
    await this.wallet.mutate({
      userId,
      type: TxType.game_stake,
      coinsDelta: -GamesService.LUDO_STAKE,
      refId: stakeRefId,
      metadata: { pending: true },
    }).catch((err) => {
      if (err instanceof ConflictException) {
        throw new ConflictException('insufficient coins for Ludo entry');
      }
      throw err;
    });

    try {
      const { gameId, state } = await this.realtime.ludoQuickMatch(userId);
      // Record the round for ledger traceability. Winner + endedAt are filled
      // in when the Go engine posts back on game end (Phase 3b hook — for now
      // we persist the "started" row and lean on manual reconciliation).
      await this.prisma.gameRound.create({
        data: {
          id: gameId,
          kind: GameKind.ludo,
          stakeCoins: GamesService.LUDO_STAKE,
          participants: [userId],
          metadata: { stakeRefId },
        },
      });
      return {
        gameId,
        roomUrl: `/games/ludo/${gameId}`,
        state,
      };
    } catch (err) {
      // Refund the stake on matchmaking failure.
      await this.wallet.mutate({
        userId,
        type: TxType.game_payout,
        coinsDelta: GamesService.LUDO_STAKE,
        refId: `${stakeRefId}-refund`,
        metadata: { reason: 'matchmaking failed' },
      }).catch(() => {});
      this.logger.warn(`ludo match failed for ${userId}: ${err}`);
      throw err;
    }
  }

  /**
   * Settle a finished Ludo round. Invoked by the Go engine via an internal
   * webhook (Phase 3b wiring — for now callable by admin tools).
   */
  async settleLudo(
    gameId: string,
    winnerId: string,
    participants: string[],
  ): Promise<void> {
    await this.wallet.mutate({
      userId: winnerId,
      type: TxType.game_payout,
      coinsDelta: GamesService.LUDO_PAYOUT,
      refId: `ludo-${gameId}-payout`,
      metadata: { gameId, participants },
    });
    await this.prisma.gameRound.update({
      where: { id: gameId },
      data: { winnerId, endedAt: new Date() },
    });
  }
}
