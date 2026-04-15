import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { PhoneHasher } from '../common/crypto/phone-hasher.service';
import type { RedisService } from '../redis/redis.service';
import { OtpService } from './otp.service';

/** Minimal in-memory RedisService stub tuned for OtpService's API surface. */
class FakeRedis {
  private store = new Map<string, string>();

  async setex(key: string, _ttl: number, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) if (this.store.delete(k)) n++;
    return n;
  }
  async incrWithTtl(key: string, _ttl: number): Promise<number> {
    const n = Number(this.store.get(key) ?? '0') + 1;
    this.store.set(key, String(n));
    return n;
  }

  /** Test helper: directly read or mutate state. */
  _peek(key: string): string | undefined {
    return this.store.get(key);
  }
  _seed(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function buildService(localMode: boolean): {
  service: OtpService;
  redis: FakeRedis;
} {
  const redis = new FakeRedis();
  const hasher = new PhoneHasher({
    getOrThrow: () => 'test_secret_value_long_enough',
  } as unknown as ConfigService);
  const config = {
    get: (key: string) =>
      key === 'LOCAL_OTP_MODE' ? (localMode ? 'true' : 'false') : undefined,
  } as unknown as ConfigService;
  const service = new OtpService(redis as unknown as RedisService, hasher, config);
  return { service, redis };
}

describe('OtpService', () => {
  const phone = '+966512345678';

  it('issues a 6-digit code and exposes it in local mode', async () => {
    const { service } = buildService(true);
    const { localCode } = await service.issue(phone);
    expect(localCode).toMatch(/^\d{6}$/);
  });

  it('does not expose the code when not in local mode', async () => {
    const { service } = buildService(false);
    const res = await service.issue(phone);
    expect(res.localCode).toBeUndefined();
  });

  it('verifies a correct code exactly once', async () => {
    const { service } = buildService(true);
    const { localCode } = await service.issue(phone);
    expect(await service.verify(phone, localCode!)).toBe(true);
    // Code is consumed.
    expect(await service.verify(phone, localCode!)).toBe(false);
  });

  it('rejects an incorrect code', async () => {
    const { service } = buildService(true);
    await service.issue(phone);
    expect(await service.verify(phone, '000000')).toBe(false);
  });

  it('requires 6 digits exactly', async () => {
    const { service } = buildService(true);
    await expect(service.verify(phone, '12345')).rejects.toThrow();
    await expect(service.verify(phone, '1234567')).rejects.toThrow();
    await expect(service.verify(phone, 'abcdef')).rejects.toThrow();
  });

  it('locks after too many wrong attempts', async () => {
    const { service } = buildService(true);
    await service.issue(phone);
    for (let i = 0; i < OtpService.MAX_VERIFY_ATTEMPTS; i++) {
      expect(await service.verify(phone, '000000')).toBe(false);
    }
    await expect(service.verify(phone, '000000')).rejects.toThrow(HttpException);
  });

  it('caps hourly OTP requests per phone', async () => {
    const { service } = buildService(true);
    for (let i = 0; i < OtpService.HOURLY_REQUEST_LIMIT; i++) {
      await service.issue(phone);
    }
    await expect(service.issue(phone)).rejects.toThrow(HttpException);
  });
});
