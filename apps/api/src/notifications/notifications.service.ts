import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { isWithinPrayerQuietHours } from './prayer-times';

export interface NotificationInput {
  userId: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  /** Arbitrary payload the client reads to route on tap. */
  data?: Record<string, string>;
  /** Ignore quiet hours — use only for account security alerts. */
  urgent?: boolean;
}

/**
 * Phase 6 notification dispatcher.
 *
 * Today: logs to the API logs (local dev), keyed by FCM token.
 * Production: swap `send()` for a Firebase Admin SDK call.
 *
 * Policy:
 *   - Respects per-user `notificationsEnabled` flag.
 *   - Respects per-user `prayerQuietHours` — prayer windows computed
 *     from the user's country as a coarse default; a device-local
 *     recomputation happens on the mobile side for accuracy.
 *   - `urgent: true` bypasses quiet hours (password reset, security).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerDevice(
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
  ): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform, lastSeenAt: new Date() },
    });
  }

  async unregisterDevice(token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { token } });
  }

  async send(input: NotificationInput): Promise<{ sent: number; skipped: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        language: true,
        country: true,
        notificationsEnabled: true,
        prayerQuietHours: true,
      },
    });
    if (!user) return { sent: 0, skipped: 0 };

    if (!user.notificationsEnabled && !input.urgent) {
      return { sent: 0, skipped: 1 };
    }
    if (
      user.prayerQuietHours &&
      !input.urgent &&
      isWithinPrayerQuietHours(new Date(), user.country)
    ) {
      this.logger.log(
        `push suppressed (prayer quiet hours) user=${user.id} ` +
          `title="${user.language === 'en' ? input.titleEn : input.titleAr}"`,
      );
      return { sent: 0, skipped: 1 };
    }

    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: user.id },
      select: { token: true, platform: true },
    });
    if (tokens.length === 0) return { sent: 0, skipped: 0 };

    const title = user.language === 'en' ? input.titleEn : input.titleAr;
    const body = user.language === 'en' ? input.bodyEn : input.bodyAr;
    for (const t of tokens) {
      // TODO(prod): replace with firebase-admin messaging.send().
      this.logger.log(
        `[PUSH][${t.platform}] to=${t.token.slice(0, 12)}… ` +
          `"${title}" :: "${body}" data=${JSON.stringify(input.data ?? {})}`,
      );
    }
    return { sent: tokens.length, skipped: 0 };
  }
}
