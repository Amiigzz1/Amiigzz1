import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';

export interface AgoraJoinToken {
  /** Unique Agora channel id bound to a room. */
  channel: string;
  /** App id; clients need this to initialize the SDK. Empty in mock mode. */
  appId: string;
  /** Opaque token passed to `rtcEngine.joinChannel`. */
  token: string;
  /** Integer UID Agora expects. We derive it from the Majlis user UUID. */
  uid: number;
  /** Expiry timestamp (Unix seconds). */
  expiresAt: number;
  /** `publisher` lets the user talk; `audience` is listen-only. */
  role: 'publisher' | 'audience';
}

/**
 * AgoraService
 * ------------
 * Abstracts the Agora voice SDK's server-side token generation.
 *
 * Two modes:
 *   - `mock`  — returns a deterministic, signed fake token. The Flutter
 *               client treats it as a stub and does not call Agora. This
 *               is the default for local dev and CI.
 *   - `agora` — produces a real RTC token. For Phase 2 the implementation
 *               is a TODO; we will add `agora-access-token` when the keys
 *               are provisioned.
 *
 * Design note: keeping the fake token signed with `PHONE_HASH_SECRET`
 * (well, a dedicated section of it) means we can validate the token on
 * the realtime service even in mock mode — handy for integration tests.
 */
@Injectable()
export class AgoraService {
  private readonly logger = new Logger(AgoraService.name);
  private readonly mode: 'mock' | 'agora';
  private readonly appId: string;
  private readonly appCertificate: string;
  private readonly ttlSeconds = 60 * 60; // 1 hour

  constructor(config: ConfigService) {
    this.mode = (config.get<string>('AGORA_MODE') ?? 'mock') as
      | 'mock'
      | 'agora';
    this.appId = config.get<string>('AGORA_APP_ID') ?? '';
    this.appCertificate = config.get<string>('AGORA_APP_CERTIFICATE') ?? '';
  }

  /**
   * Mints a channel-join token for a user. The `role` controls whether
   * they can publish audio (speakers) or only subscribe (listeners).
   */
  issueJoinToken(args: {
    channel: string;
    userId: string;
    role: 'publisher' | 'audience';
  }): AgoraJoinToken {
    const uid = this.deriveUid(args.userId);
    const expiresAt = Math.floor(Date.now() / 1000) + this.ttlSeconds;

    if (this.mode === 'mock') {
      return {
        channel: args.channel,
        appId: 'mock-app-id',
        token: this.buildMockToken(args.channel, uid, args.role, expiresAt),
        uid,
        expiresAt,
        role: args.role,
      };
    }

    // TODO(phase-prod): wire `agora-access-token` and build a real RtcToken.
    // Until then, in `agora` mode without credentials we fail loud.
    if (!this.appId || !this.appCertificate) {
      throw new Error(
        'AGORA_MODE=agora requires AGORA_APP_ID and AGORA_APP_CERTIFICATE',
      );
    }
    throw new Error('Real Agora token generation not implemented yet');
  }

  /** Opaque channel id that the Rooms service persists on the DB row. */
  newChannelId(): string {
    return `majlis-${randomBytes(8).toString('hex')}`;
  }

  /** Deterministic uint32 Agora UID from a Majlis user UUID. */
  private deriveUid(userId: string): number {
    const h = createHmac('sha256', 'agora-uid')
      .update(userId)
      .digest();
    // Avoid 0 (Agora reserves it) and stay within uint31 for safety.
    return (h.readUInt32BE(0) % 0x7fff_fffe) + 1;
  }

  private buildMockToken(
    channel: string,
    uid: number,
    role: 'publisher' | 'audience',
    expiresAt: number,
  ): string {
    const payload = `${channel}|${uid}|${role}|${expiresAt}`;
    const sig = createHmac('sha256', 'mock-agora-cert-do-not-ship')
      .update(payload)
      .digest('hex')
      .slice(0, 16);
    return `mock.${Buffer.from(payload).toString('base64url')}.${sig}`;
  }
}
