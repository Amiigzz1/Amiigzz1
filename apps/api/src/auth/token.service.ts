import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface AccessTokenPayload {
  sub: string; // user id
  typ: 'access';
}

export interface IssuedTokenPair {
  accessToken: string;
  accessTokenExpiresIn: number; // seconds
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

/**
 * Duration strings ("15m", "30d") are parsed here so the DB mirror can store
 * a concrete `expires_at`. Keep the grammar tiny on purpose.
 */
function parseDuration(spec: string): number {
  const match = /^(\d+)([smhd])$/.exec(spec.trim());
  if (!match) throw new Error(`invalid duration: ${spec}`);
  const n = Number(match[1]);
  const unit = match[2];
  const mult = { s: 1, m: 60, h: 3_600, d: 86_400 }[unit]!;
  return n * mult;
}

@Injectable()
export class TokenService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.accessTtlSeconds = parseDuration(
      config.get<string>('JWT_ACCESS_TTL') ?? '15m',
    );
    this.refreshTtlSeconds = parseDuration(
      config.get<string>('JWT_REFRESH_TTL') ?? '30d',
    );
  }

  /**
   * Issue a fresh access + refresh pair for a user. The refresh token is an
   * opaque random string; its SHA-256 hash is persisted in both Postgres
   * (durable) and Redis (hot path).
   */
  async issuePair(
    userId: string,
    meta: { deviceId?: string; userAgent?: string; ipHash?: string } = {},
  ): Promise<IssuedTokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, typ: 'access' } satisfies AccessTokenPayload,
      { expiresIn: this.accessTtlSeconds },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = this.hashRefresh(refreshToken);
    const expiresAt = new Date(Date.now() + this.refreshTtlSeconds * 1_000);

    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        deviceId: meta.deviceId ?? null,
        userAgent: meta.userAgent?.slice(0, 256) ?? null,
        ipHash: meta.ipHash ?? null,
        expiresAt,
      },
    });

    // Redis mirror for fast rotation/revocation checks. Key encodes the token
    // hash so we can locate it without scanning.
    await this.redis.setex(
      `refresh:${tokenHash}`,
      this.refreshTtlSeconds,
      JSON.stringify({ id: record.id, userId }),
    );
    // Per-user index so "logout everywhere" is O(set cardinality).
    await this.redis.client.sadd(`user:${userId}:refreshes`, tokenHash);

    return {
      accessToken,
      accessTokenExpiresIn: this.accessTtlSeconds,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  /**
   * Validate an incoming refresh token. Returns the owning userId on success,
   * null otherwise. Does NOT rotate — callers do that via `rotate`.
   */
  async resolveRefresh(
    refreshToken: string,
  ): Promise<{ userId: string; id: string } | null> {
    const tokenHash = this.hashRefresh(refreshToken);
    const cached = await this.redis.get(`refresh:${tokenHash}`);
    if (cached) {
      return JSON.parse(cached) as { userId: string; id: string };
    }

    // Fallback: Redis cold / flushed — authoritative check in Postgres.
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!row) return null;
    if (row.revokedAt) return null;
    if (row.expiresAt.getTime() < Date.now()) return null;
    return { userId: row.userId, id: row.id };
  }

  /**
   * Rotate a refresh token: revoke the old one, issue a new pair. If the old
   * token is presented again, we treat it as a replay and nuke all sessions
   * for that user (standard refresh-token-reuse detection).
   */
  async rotate(
    oldRefresh: string,
    meta: { deviceId?: string; userAgent?: string; ipHash?: string } = {},
  ): Promise<IssuedTokenPair | null> {
    const resolved = await this.resolveRefresh(oldRefresh);
    if (!resolved) return null;

    const oldHash = this.hashRefresh(oldRefresh);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: oldHash },
    });

    if (!existing || existing.revokedAt) {
      // Replay of a revoked token → treat as compromised. Revoke everything.
      await this.revokeAllForUser(resolved.userId);
      return null;
    }

    const pair = await this.issuePair(resolved.userId, meta);
    const newHash = this.hashRefresh(pair.refreshToken);
    const newRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: newHash },
    });

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), rotatedTo: newRecord?.id ?? null },
    });
    await this.redis.del(`refresh:${oldHash}`);
    await this.redis.client.srem(
      `user:${resolved.userId}:refreshes`,
      oldHash,
    );

    return pair;
  }

  /** Revoke a specific refresh token (logout on this device). */
  async revoke(refreshToken: string): Promise<void> {
    const tokenHash = this.hashRefresh(refreshToken);
    const resolved = await this.resolveRefresh(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.redis.del(`refresh:${tokenHash}`);
    if (resolved) {
      await this.redis.client.srem(
        `user:${resolved.userId}:refreshes`,
        tokenHash,
      );
    }
  }

  /** Revoke every refresh token for a user (ban or "log out everywhere"). */
  async revokeAllForUser(userId: string): Promise<void> {
    const hashes = await this.redis.client.smembers(
      `user:${userId}:refreshes`,
    );
    if (hashes.length > 0) {
      await this.redis.del(...hashes.map((h) => `refresh:${h}`));
      await this.redis.client.del(`user:${userId}:refreshes`);
    }
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
