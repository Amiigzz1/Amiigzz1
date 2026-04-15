import type { ConfigService } from '@nestjs/config';

import { AgoraService } from './agora.service';

function makeService(env: Record<string, string>): AgoraService {
  const config = {
    get: (k: string) => env[k],
  } as unknown as ConfigService;
  return new AgoraService(config);
}

describe('AgoraService (mock mode)', () => {
  const svc = makeService({ AGORA_MODE: 'mock' });

  it('issues deterministic UIDs per user', () => {
    const a = svc.issueJoinToken({
      channel: 'majlis-abc',
      userId: 'user-1',
      role: 'audience',
    });
    const b = svc.issueJoinToken({
      channel: 'majlis-abc',
      userId: 'user-1',
      role: 'audience',
    });
    expect(a.uid).toBe(b.uid);
    expect(a.uid).toBeGreaterThan(0);
    expect(a.uid).toBeLessThan(0x7fff_ffff);
  });

  it('different users get different UIDs', () => {
    const a = svc.issueJoinToken({
      channel: 'majlis-abc',
      userId: 'user-1',
      role: 'publisher',
    });
    const b = svc.issueJoinToken({
      channel: 'majlis-abc',
      userId: 'user-2',
      role: 'publisher',
    });
    expect(a.uid).not.toBe(b.uid);
  });

  it('mock token has 3 base64url+hex segments and is prefixed with mock.', () => {
    const t = svc.issueJoinToken({
      channel: 'majlis-abc',
      userId: 'user-1',
      role: 'audience',
    }).token;
    expect(t.startsWith('mock.')).toBe(true);
    expect(t.split('.')).toHaveLength(3);
  });

  it('exposes role + expiry', () => {
    const before = Math.floor(Date.now() / 1000);
    const r = svc.issueJoinToken({
      channel: 'majlis-abc',
      userId: 'user-1',
      role: 'publisher',
    });
    expect(r.role).toBe('publisher');
    expect(r.expiresAt).toBeGreaterThan(before);
  });

  it('newChannelId returns a namespaced random id', () => {
    const id = svc.newChannelId();
    expect(id).toMatch(/^majlis-[0-9a-f]{16}$/);
    expect(id).not.toBe(svc.newChannelId());
  });
});

describe('AgoraService (agora mode, no credentials)', () => {
  it('throws when AGORA_MODE=agora but credentials are missing', () => {
    const svc = makeService({ AGORA_MODE: 'agora' });
    expect(() =>
      svc.issueJoinToken({
        channel: 'majlis-abc',
        userId: 'user-1',
        role: 'audience',
      }),
    ).toThrow(/AGORA_APP_ID/);
  });
});
