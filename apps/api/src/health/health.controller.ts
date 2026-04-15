import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type Status = 'ok' | 'degraded';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check(): Promise<{
    status: Status;
    service: 'majlis-api';
    uptimeSeconds: number;
    timestamp: string;
    checks: { postgres: boolean; redis: boolean };
  }> {
    const [postgres, redis] = await Promise.all([
      this.pingPostgres(),
      this.pingRedis(),
    ]);

    const allOk = postgres && redis;
    const body = {
      status: (allOk ? 'ok' : 'degraded') as Status,
      service: 'majlis-api' as const,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      checks: { postgres, redis },
    };

    if (!allOk) {
      throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return body;
  }

  private async pingPostgres(): Promise<boolean> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async pingRedis(): Promise<boolean> {
    try {
      const reply = await this.redis.client.ping();
      return reply === 'PONG';
    } catch {
      return false;
    }
  }
}
