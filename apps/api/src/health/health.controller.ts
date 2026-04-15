import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  @Get()
  check(): {
    status: 'ok';
    service: 'majlis-api';
    uptimeSeconds: number;
    timestamp: string;
  } {
    return {
      status: 'ok',
      service: 'majlis-api',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
