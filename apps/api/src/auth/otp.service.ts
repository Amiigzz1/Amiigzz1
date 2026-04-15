import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, timingSafeEqual } from 'node:crypto';

import { PhoneHasher } from '../common/crypto/phone-hasher.service';
import { RedisService } from '../redis/redis.service';

/**
 * OTP lifecycle
 * -------------
 * 1. `issue(e164)` generates a 6-digit code, stores it in Redis under
 *    `otp:code:{phone_hash}` with a 5-minute TTL, and rate-limits requests.
 * 2. `verify(e164, code)` compares in constant time, invalidates the code,
 *    and returns `true` on success.
 *
 * In `LOCAL_OTP_MODE=true` the code is printed to the API logs so developers
 * can grab it without an SMS provider. This must be `false` in production.
 *
 * Rate limits
 * -----------
 * - Max 5 OTP requests per phone per hour (`otp:rate:hour:{hash}`).
 * - Max 3 verify attempts per OTP (`otp:attempts:{hash}`).
 *
 * TODO(phase-prod): swap `emitLocal` for Firebase / Unifonic / MSG91.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly localMode: boolean;

  static readonly CODE_TTL_SECONDS = 5 * 60;
  static readonly HOURLY_REQUEST_LIMIT = 5;
  static readonly MAX_VERIFY_ATTEMPTS = 3;

  constructor(
    private readonly redis: RedisService,
    private readonly hasher: PhoneHasher,
    config: ConfigService,
  ) {
    this.localMode = config.get<string>('LOCAL_OTP_MODE') === 'true';
  }

  /**
   * Issue a new OTP for the given E.164 phone number.
   * Returns the code **only in local mode** for testing convenience;
   * the caller must not leak it in API responses.
   */
  async issue(e164: string): Promise<{ phoneHash: string; localCode?: string }> {
    const phoneHash = this.hasher.hash(e164);

    const hourly = await this.redis.incrWithTtl(
      `otp:rate:hour:${phoneHash}`,
      60 * 60,
    );
    if (hourly > OtpService.HOURLY_REQUEST_LIMIT) {
      throw new HttpException(
        'Too many OTP requests. Try again in an hour.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.redis.setex(
      `otp:code:${phoneHash}`,
      OtpService.CODE_TTL_SECONDS,
      code,
    );
    // Reset the attempts counter for this issuance.
    await this.redis.del(`otp:attempts:${phoneHash}`);

    if (this.localMode) {
      this.emitLocal(e164, code);
      return { phoneHash, localCode: code };
    }

    // TODO(phase-prod): dispatch via real SMS provider here.
    return { phoneHash };
  }

  /**
   * Verify an OTP. Returns true iff the code matches and is unexpired.
   * Consumes the code on success; increments the attempt counter on failure.
   */
  async verify(e164: string, submittedCode: string): Promise<boolean> {
    if (!/^\d{6}$/.test(submittedCode)) {
      throw new BadRequestException('OTP code must be 6 digits');
    }

    const phoneHash = this.hasher.hash(e164);

    const attempts = await this.redis.incrWithTtl(
      `otp:attempts:${phoneHash}`,
      OtpService.CODE_TTL_SECONDS,
    );
    if (attempts > OtpService.MAX_VERIFY_ATTEMPTS) {
      await this.redis.del(`otp:code:${phoneHash}`);
      throw new HttpException(
        'Too many incorrect attempts. Request a new OTP.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const storedCode = await this.redis.get(`otp:code:${phoneHash}`);
    if (!storedCode) {
      return false;
    }

    const a = Buffer.from(storedCode);
    const b = Buffer.from(submittedCode);
    const ok = a.length === b.length && timingSafeEqual(a, b);

    if (ok) {
      await this.redis.del(
        `otp:code:${phoneHash}`,
        `otp:attempts:${phoneHash}`,
      );
    }
    return ok;
  }

  private emitLocal(e164: string, code: string): void {
    this.logger.warn(
      `[OTP] phone=${this.hasher.redact(e164)} code=${code} ` +
        `(expires in ${OtpService.CODE_TTL_SECONDS / 60}m, local mode)`,
    );
  }
}
