import type { PrismaService } from '../prisma/prisma.service';
import type { AvatarService } from './avatar/avatar.service';
import { UsersService } from './users.service';

function fakeUser(overrides: Partial<Record<string, unknown>> = {}): any {
  return {
    id: 'user-1',
    displayName: 'Ali',
    avatarUrl: null,
    country: 'SA',
    language: 'ar',
    birthdate: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    profile: {
      bio: null,
      favoriteGames: [],
      badges: [],
      frameId: null,
      nameplateId: null,
    },
    ...overrides,
  };
}

describe('UsersService.getMe', () => {
  it('returns the shaped user', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(fakeUser()),
      },
    } as unknown as PrismaService;
    const svc = new UsersService(prisma, {} as AvatarService);

    const result = await svc.getMe('user-1');

    expect(result.id).toBe('user-1');
    expect(result.displayName).toBe('Ali');
    expect(result.country).toBe('SA');
    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.profile.favoriteGames).toEqual([]);
  });

  it('throws NotFound when user is absent', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const svc = new UsersService(prisma, {} as AvatarService);

    await expect(svc.getMe('missing')).rejects.toThrow(/not found/i);
  });
});

describe('UsersService.updateMe', () => {
  it('splits user-level and profile-level fields in a single transaction', async () => {
    const tx = jest.fn().mockResolvedValue([
      undefined,
      fakeUser({
        displayName: 'Majid',
        profile: {
          bio: 'hello',
          favoriteGames: ['ludo'],
          badges: [],
          frameId: null,
          nameplateId: null,
        },
      }),
    ]);
    const prisma = {
      $transaction: tx,
      userProfile: {
        upsert: jest.fn().mockReturnValue('upsert-op'),
      },
      user: {
        update: jest.fn().mockReturnValue('update-op'),
      },
    } as unknown as PrismaService;
    const svc = new UsersService(prisma, {} as AvatarService);

    const result = await svc.updateMe('user-1', {
      displayName: 'Majid',
      bio: 'hello',
      favoriteGames: ['ludo'],
    });

    expect(result.displayName).toBe('Majid');
    expect(result.profile.bio).toBe('hello');
    expect(result.profile.favoriteGames).toEqual(['ludo']);
    expect(tx).toHaveBeenCalledWith(['upsert-op', 'update-op']);

    // Profile vs. user field split.
    const profileArgs = (prisma.userProfile.upsert as jest.Mock).mock.calls[0][0];
    expect(profileArgs.update).toEqual({ bio: 'hello', favoriteGames: ['ludo'] });
    const userArgs = (prisma.user.update as jest.Mock).mock.calls[0][0];
    expect(userArgs.data).toEqual({ displayName: 'Majid' });
  });
});

describe('UsersService.uploadAvatar', () => {
  it('calls AvatarService and persists primaryUrl', async () => {
    const prisma = {
      user: {
        update: jest.fn().mockResolvedValue(
          fakeUser({ avatarUrl: 'http://cdn/m.webp' }),
        ),
      },
    } as unknown as PrismaService;
    const avatar = {
      processAndUpload: jest.fn().mockResolvedValue({
        urls: {
          small: 'http://cdn/s.webp',
          medium: 'http://cdn/m.webp',
          large: 'http://cdn/l.webp',
        },
        primaryUrl: 'http://cdn/m.webp',
        version: 'abc123',
      }),
    } as unknown as AvatarService;

    const svc = new UsersService(prisma, avatar);
    const result = await svc.uploadAvatar('user-1', {
      buffer: Buffer.from(''),
      mimetype: 'image/jpeg',
      size: 1,
    });

    expect(result.avatarUrl).toBe('http://cdn/m.webp');
    expect((prisma.user.update as jest.Mock).mock.calls[0][0].data).toEqual({
      avatarUrl: 'http://cdn/m.webp',
    });
  });
});
