import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  async function buildController(opts: {
    pgOk?: boolean;
    redisOk?: boolean;
  }): Promise<HealthController> {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRawUnsafe: jest.fn().mockImplementation(() => {
              if (opts.pgOk === false) throw new Error('pg down');
              return Promise.resolve();
            }),
          },
        },
        {
          provide: RedisService,
          useValue: {
            client: {
              ping: jest
                .fn()
                .mockResolvedValue(opts.redisOk === false ? 'DOWN' : 'PONG'),
            },
          },
        },
      ],
    }).compile();
    return module.get(HealthController);
  }

  it('returns ok when all dependencies respond', async () => {
    const c = await buildController({ pgOk: true, redisOk: true });
    const body = await c.check();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('majlis-api');
    expect(body.checks).toEqual({ postgres: true, redis: true });
  });

  it('returns 503 when postgres is unreachable', async () => {
    const c = await buildController({ pgOk: false, redisOk: true });
    await expect(c.check()).rejects.toMatchObject({ status: 503 });
  });

  it('returns 503 when redis is unreachable', async () => {
    const c = await buildController({ pgOk: true, redisOk: false });
    await expect(c.check()).rejects.toMatchObject({ status: 503 });
  });
});
