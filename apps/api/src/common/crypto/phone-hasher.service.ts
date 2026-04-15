import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

/**
 * HMAC-SHA256 phone hasher.
 *
 * Produces a stable, non-reversible fingerprint of a phone number using a
 * secret key (`PHONE_HASH_SECRET`). Used everywhere we need to *look up*
 * or *log* a phone without storing it in clear.
 *
 * TODO(scale): move `PHONE_HASH_SECRET` to AWS KMS with automatic rotation.
 */
@Injectable()
export class PhoneHasher {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('PHONE_HASH_SECRET');
  }

  /** Deterministic HMAC digest of an E.164 phone number. */
  hash(e164: string): string {
    return createHmac('sha256', this.secret).update(e164).digest('hex');
  }

  /** Redact for logs: +9665XXXXXX1234 → +966****1234 */
  redact(e164: string): string {
    if (e164.length <= 6) return '****';
    return `${e164.slice(0, 4)}****${e164.slice(-4)}`;
  }
}
