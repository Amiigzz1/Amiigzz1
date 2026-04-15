import type { ConfigService } from '@nestjs/config';

import { PhoneHasher } from './phone-hasher.service';

function makeHasher(secret: string): PhoneHasher {
  const config = {
    getOrThrow: (key: string) => {
      if (key === 'PHONE_HASH_SECRET') return secret;
      throw new Error(`unexpected key: ${key}`);
    },
  } as unknown as ConfigService;
  return new PhoneHasher(config);
}

describe('PhoneHasher', () => {
  it('is deterministic for a given secret', () => {
    const h = makeHasher('test_secret_value_long_enough');
    const a = h.hash('+966512345678');
    const b = h.hash('+966512345678');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the secret changes', () => {
    const a = makeHasher('secret_one_value_long_enough').hash('+966512345678');
    const b = makeHasher('secret_two_value_long_enough').hash('+966512345678');
    expect(a).not.toBe(b);
  });

  it('redacts phones for logging', () => {
    const h = makeHasher('test_secret_value_long_enough');
    expect(h.redact('+966512345678')).toBe('+966****5678');
    expect(h.redact('+971501234567')).toBe('+971****4567');
    expect(h.redact('short')).toBe('****');
  });
});
