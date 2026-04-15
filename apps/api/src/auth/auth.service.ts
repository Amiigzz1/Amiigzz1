import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Country } from '@prisma/client';
import { createHash } from 'node:crypto';

import { PhoneHasher } from '../common/crypto/phone-hasher.service';
import { PhoneValidator } from '../common/phone/phone-validator';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from './otp.service';
import { TokenService, type IssuedTokenPair } from './token.service';

export interface LoginResult {
  userId: string;
  isNewUser: boolean;
  tokens: IssuedTokenPair;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly localMode: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly phones: PhoneValidator,
    private readonly hasher: PhoneHasher,
    config: ConfigService,
  ) {
    this.localMode = config.get<string>('LOCAL_OTP_MODE') === 'true';
  }

  /**
   * Request an OTP for a phone. Always returns success to avoid leaking
   * which numbers are registered (user enumeration).
   *
   * In local mode we return the plaintext code in the response so the
   * Flutter dev loop doesn't need log scraping.
   */
  async requestOtp(
    rawPhone: string,
    countryHint?: string,
  ): Promise<{ devCode?: string }> {
    const { e164 } = this.phones.normalize(rawPhone, countryHint);
    const result = await this.otp.issue(e164);
    this.logger.log(
      `otp issued redacted=${this.hasher.redact(e164)} hash=${result.phoneHash.slice(0, 8)}…`,
    );
    return this.localMode ? { devCode: result.localCode } : {};
  }

  /**
   * Verify an OTP and either create or fetch the user, then issue tokens.
   */
  async verifyOtp(
    rawPhone: string,
    code: string,
    meta: {
      countryHint?: string;
      deviceId?: string;
      userAgent?: string;
      ip?: string;
    },
  ): Promise<LoginResult> {
    const { e164, country } = this.phones.normalize(rawPhone, meta.countryHint);

    const ok = await this.otp.verify(e164, code);
    if (!ok) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const phoneHash = this.hasher.hash(e164);
    const existing = await this.prisma.user.findUnique({
      where: { phoneHash },
      select: { id: true, bannedAt: true },
    });
    if (existing?.bannedAt) {
      throw new UnauthorizedException('Account suspended');
    }

    let userId: string;
    let isNewUser = false;
    if (existing) {
      userId = existing.id;
    } else {
      // PhoneValidator already enforced ALLOWED_COUNTRIES ⊆ Prisma Country enum.
      const created = await this.prisma.user.create({
        data: {
          phoneHash,
          country: country as Country,
          profile: { create: {} },
        },
        select: { id: true },
      });
      userId = created.id;
      isNewUser = true;
      this.logger.log(`user created id=${userId} country=${country}`);
    }

    const tokens = await this.tokens.issuePair(userId, {
      deviceId: meta.deviceId,
      userAgent: meta.userAgent,
      ipHash: meta.ip ? this.hashIp(meta.ip) : undefined,
    });

    return { userId, isNewUser, tokens };
  }

  async refresh(
    refreshToken: string,
    meta: { deviceId?: string; userAgent?: string; ip?: string },
  ): Promise<IssuedTokenPair> {
    const pair = await this.tokens.rotate(refreshToken, {
      deviceId: meta.deviceId,
      userAgent: meta.userAgent,
      ipHash: meta.ip ? this.hashIp(meta.ip) : undefined,
    });
    if (!pair) {
      throw new UnauthorizedException('Invalid or reused refresh token');
    }
    return pair;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  private hashIp(ip: string): string {
    // IPs are PII; hash them before storing. Bucket at /24 for IPv4 so we
    // keep some useful fraud signal without persisting the raw value.
    const bucket = ip.includes('.')
      ? ip.split('.').slice(0, 3).join('.') + '.0'
      : ip;
    return createHash('sha256').update(bucket).digest('hex');
  }
}
