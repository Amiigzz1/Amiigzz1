import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin client for the Go realtime service.
 *
 * Communicates via HTTP on the cluster network, authenticated with a shared
 * `REALTIME_INTERNAL_TOKEN`. Failures are logged but never thrown into the
 * foreground request path — rooms must still be createable even if the
 * realtime service is temporarily unreachable (it'll catch up on first WS
 * connect via EnsureRoom).
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly baseUrl: string;
  private readonly internalToken: string;

  constructor(config: ConfigService) {
    this.baseUrl =
      (config.get<string>('REALTIME_URL') ?? 'http://realtime:8080').replace(
        /\/+$/,
        '',
      );
    this.internalToken =
      config.get<string>('REALTIME_INTERNAL_TOKEN') ?? '';
  }

  async ensureRoom(input: {
    id: string;
    ownerId: string;
    maxSeats: number;
  }): Promise<void> {
    await this.call('POST', '/internal/rooms', input).catch((err) => {
      this.logger.warn(`realtime ensureRoom failed: ${err}`);
    });
  }

  async kick(roomId: string, requesterId: string, targetId: string): Promise<void> {
    await this.call('POST', `/internal/rooms/${roomId}/kick`, {
      requesterId,
      targetId,
    });
  }

  async setLock(
    roomId: string,
    requesterId: string,
    locked: boolean,
  ): Promise<void> {
    await this.call('POST', `/internal/rooms/${roomId}/lock`, {
      requesterId,
      locked,
    });
  }

  async takeSeat(
    roomId: string,
    requesterId: string,
    seatIndex: number,
  ): Promise<void> {
    await this.call('POST', `/internal/rooms/${roomId}/seats`, {
      requesterId,
      seatIndex,
    });
  }

  async leaveSeat(roomId: string, requesterId: string): Promise<void> {
    await this.call('DELETE', `/internal/rooms/${roomId}/seats`, {
      requesterId,
      seatIndex: -1,
    });
  }

  async mute(
    roomId: string,
    requesterId: string,
    targetId: string,
    muted: boolean,
  ): Promise<void> {
    await this.call('POST', `/internal/rooms/${roomId}/mute`, {
      requesterId,
      targetId,
      muted,
    });
  }

  private async call(
    method: 'POST' | 'DELETE',
    path: string,
    body: unknown,
  ): Promise<void> {
    if (!this.internalToken) {
      this.logger.warn(
        'REALTIME_INTERNAL_TOKEN is unset; skipping realtime call',
      );
      return;
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-internal-token': this.internalToken,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`realtime ${method} ${path} → ${res.status} ${text}`);
    }
  }
}
