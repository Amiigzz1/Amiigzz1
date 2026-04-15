import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ModerationActionKind,
  Prisma,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';

import { classify } from '../../../../packages/arabic-nlp/src';
import { PrismaService } from '../prisma/prisma.service';

export interface ScanResult {
  allow: boolean;
  score: number;
  categories: string[];
  matches: string[];
}

export interface FileReportInput {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  roomId?: string;
  category: string;
  details?: string;
}

/**
 * Core of the moderation pipeline.
 *
 * Pipeline for text (chat messages, bios, room names):
 *   1. Local Arabic NLP scan (offline, always-on).
 *   2. If `MODERATION_MODE=openai`, call the OpenAI moderation endpoint
 *      for a second opinion. We OR the two signals — either layer flagging
 *      means the message is held back and a report row is filed.
 *   3. If the message is clean, broadcast it. If not, persist a
 *      ModerationReport in `open` status for the human queue.
 *
 * No automatic bans. Every action on a user is a human moderator call in
 * the admin dashboard. This is the signature Majlis differentiator — see
 * docs/community_guidelines_ar.md.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run the text through the local NLP layer. Intended to be called inline
   * by the chat WebSocket handler (Phase 6 wiring) and by /users PATCH for
   * display names.
   *
   * Returns `{ allow: false }` when a human should look at it before the
   * text lands in front of other users.
   */
  scanText(text: string): ScanResult {
    const result = classify(text);
    return {
      allow: result.score < 40,
      score: result.score,
      categories: result.categories,
      matches: result.matches,
    };
  }

  /**
   * Persist a user-filed report. Reporter and target can't be the same
   * user. Duplicate reports against the same target within 10 minutes
   * are coalesced by returning the existing row.
   */
  async fileReport(input: FileReportInput): Promise<{ id: string; status: ReportStatus }> {
    if (
      input.targetType === ReportTargetType.user &&
      input.targetId === input.reporterId
    ) {
      throw new ConflictException('cannot report yourself');
    }

    const recent = await this.prisma.moderationReport.findFirst({
      where: {
        reporterId: input.reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        createdAt: {
          gt: new Date(Date.now() - 10 * 60 * 1000),
        },
      },
    });
    if (recent) {
      return { id: recent.id, status: recent.status };
    }

    const row = await this.prisma.moderationReport.create({
      data: {
        reporterId: input.reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        roomId: input.roomId,
        category: input.category.slice(0, 32),
        details: input.details?.slice(0, 500),
      },
    });
    this.logger.log(
      `report filed id=${row.id} reporter=${input.reporterId} ` +
        `target=${input.targetType}:${input.targetId}`,
    );
    return { id: row.id, status: row.status };
  }

  /** Admin: take action on a user. Bans set bannedAt + ban_until. */
  async takeAction(input: {
    moderatorId: string;
    targetUserId: string;
    action: ModerationActionKind;
    reason: string;
    reportId?: string;
  }): Promise<void> {
    const banUntil = this.computeBanUntil(input.action);
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.moderationAction.create({
        data: {
          moderatorId: input.moderatorId,
          targetUserId: input.targetUserId,
          action: input.action,
          reason: input.reason.slice(0, 500),
          reportId: input.reportId,
          banUntil,
        },
      });

      if (input.action !== ModerationActionKind.no_action && input.action !== ModerationActionKind.warning) {
        await tx.user.update({
          where: { id: input.targetUserId },
          data: {
            bannedAt: new Date(),
            banReason: input.reason.slice(0, 500),
          },
        });
      }

      if (input.reportId) {
        await tx.moderationReport.update({
          where: { id: input.reportId },
          data: {
            status: ReportStatus.resolved,
            resolvedAt: new Date(),
            resolverId: input.moderatorId,
          },
        });
      }

      this.logger.log(
        `moderation action ${input.action} on ${input.targetUserId} by ${input.moderatorId} ` +
          `(action_id=${row.id})`,
      );
    });
  }

  /**
   * User submits an appeal. Allowed once per (user, action). 48h SLA is
   * enforced by the admin queue, not the API.
   */
  async fileAppeal(
    userId: string,
    actionId: string,
    reason: string,
  ): Promise<{ id: string }> {
    const action = await this.prisma.moderationAction.findUnique({
      where: { id: actionId },
    });
    if (!action) throw new NotFoundException('action not found');
    if (action.targetUserId !== userId) {
      throw new ConflictException('only the affected user can appeal');
    }
    try {
      const appeal = await this.prisma.moderationAppeal.create({
        data: { userId, actionId, reason: reason.slice(0, 500) },
      });
      return { id: appeal.id };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('you already appealed this action');
      }
      throw err;
    }
  }

  private computeBanUntil(action: ModerationActionKind): Date | null {
    const now = Date.now();
    switch (action) {
      case ModerationActionKind.mute_24h:
        return new Date(now + 24 * 3600 * 1000);
      case ModerationActionKind.ban_7d:
        return new Date(now + 7 * 24 * 3600 * 1000);
      case ModerationActionKind.ban_30d:
        return new Date(now + 30 * 24 * 3600 * 1000);
      case ModerationActionKind.ban_permanent:
        return new Date(now + 100 * 365 * 24 * 3600 * 1000);
      default:
        return null;
    }
  }
}
