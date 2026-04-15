import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { AgoraService } from '../agora/agora.service';
import type { PrismaService } from '../prisma/prisma.service';
import { RoomsService } from './rooms.service';

function makeAgora(): AgoraService {
  return {
    newChannelId: jest.fn().mockReturnValue('majlis-testchannel'),
    issueJoinToken: jest.fn().mockReturnValue({
      channel: 'majlis-testchannel',
      appId: 'mock-app-id',
      token: 'mock.token.sig',
      uid: 123,
      expiresAt: 1_900_000_000,
      role: 'audience',
    }),
  } as unknown as AgoraService;
}

function fakeRow(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'room-1',
    name: 'بيت اللودو',
    description: null,
    category: 'gaming',
    country: 'SA',
    maxSeats: 8,
    locked: false,
    agoraChannel: 'majlis-testchannel',
    listenersLive: 0,
    speakersLive: 0,
    ownerId: 'user-1',
    closedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    owner: { id: 'user-1', displayName: 'Ali', avatarUrl: null },
    ...overrides,
  };
}

function makeService(prisma: PrismaService): RoomsService {
  const config = {
    get: (k: string) => (k === 'REALTIME_URL' ? 'http://realtime:8080' : undefined),
  } as unknown as ConfigService;
  return new RoomsService(prisma, makeAgora(), config);
}

describe('RoomsService.create', () => {
  it('persists the room with an Agora channel and returns a summary', async () => {
    const prisma = {
      room: {
        create: jest.fn().mockResolvedValue(fakeRow()),
      },
    } as unknown as PrismaService;
    const svc = makeService(prisma);

    const result = await svc.create('user-1', {
      name: 'بيت اللودو',
      category: 'gaming' as any,
      country: 'SA' as any,
    });

    expect(result.name).toBe('بيت اللودو');
    expect(result.owner.id).toBe('user-1');
    expect((prisma.room.create as jest.Mock).mock.calls[0][0].data).toMatchObject({
      name: 'بيت اللودو',
      category: 'gaming',
      country: 'SA',
      agoraChannel: 'majlis-testchannel',
      ownerId: 'user-1',
      maxSeats: 8,
    });
  });
});

describe('RoomsService.list', () => {
  it('applies filters, orders by activity, and returns pagination metadata', async () => {
    const rows = [fakeRow({ id: 'r1', speakersLive: 3 }), fakeRow({ id: 'r2' })];
    const prisma = {
      $transaction: jest.fn().mockResolvedValue([rows, 2]),
      room: {
        findMany: jest.fn().mockReturnValue('findMany-op'),
        count: jest.fn().mockReturnValue('count-op'),
      },
    } as unknown as PrismaService;

    const svc = makeService(prisma);
    const result = await svc.list({
      category: 'gaming' as any,
      country: 'SA' as any,
      page: 2,
      pageSize: 10,
    });

    expect(result.total).toBe(2);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.items.map((i) => i.id)).toEqual(['r1', 'r2']);

    const findArgs = (prisma.room.findMany as jest.Mock).mock.calls[0][0];
    expect(findArgs.where).toEqual({
      closedAt: null,
      category: 'gaming',
      country: 'SA',
    });
    expect(findArgs.skip).toBe(10);
    expect(findArgs.take).toBe(10);
    expect(findArgs.orderBy[0]).toEqual({ speakersLive: 'desc' });
  });
});

describe('RoomsService.getById', () => {
  it('returns detail with an Agora publisher token for the owner', async () => {
    const prisma = {
      room: {
        findUnique: jest.fn().mockResolvedValue(fakeRow()),
      },
    } as unknown as PrismaService;
    const agora = makeAgora();
    (agora.issueJoinToken as jest.Mock).mockReturnValue({
      channel: 'majlis-testchannel',
      appId: 'mock-app-id',
      token: 'mock.publisher.sig',
      uid: 123,
      expiresAt: 1_900_000_000,
      role: 'publisher',
    });
    const svc = new RoomsService(prisma, agora, {
      get: () => 'http://realtime:8080',
    } as unknown as ConfigService);

    const result = await svc.getById('user-1', 'room-1');
    expect(result.join.role).toBe('publisher');
    expect(result.agoraChannel).toBe('majlis-testchannel');
    expect(result.realtimeWsUrl).toBe('ws://realtime:8080');
  });

  it('returns audience role for non-owners', async () => {
    const prisma = {
      room: {
        findUnique: jest.fn().mockResolvedValue(fakeRow()),
      },
    } as unknown as PrismaService;
    const svc = makeService(prisma);
    const result = await svc.getById('user-other', 'room-1');
    expect(result.join.role).toBe('audience');
  });

  it('throws NotFound for missing or closed rooms', async () => {
    const prisma = {
      room: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const svc = makeService(prisma);
    await expect(svc.getById('u', 'missing')).rejects.toThrow(NotFoundException);

    const closedPrisma = {
      room: {
        findUnique: jest
          .fn()
          .mockResolvedValue(fakeRow({ closedAt: new Date() })),
      },
    } as unknown as PrismaService;
    const svc2 = makeService(closedPrisma);
    await expect(svc2.getById('u', 'room-1')).rejects.toThrow(NotFoundException);
  });

  it('blocks non-owners on locked rooms', async () => {
    const prisma = {
      room: {
        findUnique: jest.fn().mockResolvedValue(fakeRow({ locked: true })),
      },
    } as unknown as PrismaService;
    const svc = makeService(prisma);
    await expect(svc.getById('intruder', 'room-1')).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('RoomsService.closeIfOwner', () => {
  it('only the owner can close', async () => {
    const prisma = {
      room: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ownerId: 'user-1', closedAt: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;
    const svc = makeService(prisma);

    await expect(svc.closeIfOwner('not-owner', 'room-1')).rejects.toThrow(
      ForbiddenException,
    );

    await svc.closeIfOwner('user-1', 'room-1');
    expect(prisma.room.update).toHaveBeenCalled();
  });
});
