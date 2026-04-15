import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

import type { StorageService } from '../../storage/storage.service';
import { AVATAR_SIZES, AvatarService } from './avatar.service';

function makeStorage(): {
  svc: StorageService;
  uploads: Array<{ bucket: string; key: string; size: number; contentType: string }>;
} {
  const uploads: Array<{
    bucket: string;
    key: string;
    size: number;
    contentType: string;
  }> = [];
  const svc = {
    putObject: jest
      .fn()
      .mockImplementation(
        async (input: {
          bucket: string;
          key: string;
          body: Buffer;
          contentType: string;
        }) => {
          uploads.push({
            bucket: input.bucket,
            key: input.key,
            size: input.body.length,
            contentType: input.contentType,
          });
          return { url: `http://local/${input.bucket}/${input.key}` };
        },
      ),
  } as unknown as StorageService;
  return { svc, uploads };
}

function makeAvatarService(storage: StorageService): AvatarService {
  const config = {
    get: (key: string) => (key === 'S3_BUCKET_UPLOADS' ? 'majlis-uploads' : undefined),
  } as unknown as ConfigService;
  return new AvatarService(storage, config);
}

async function jpegBuffer(width: number, height = width): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe('AvatarService', () => {
  it('uploads 3 WebP variants at small/medium/large', async () => {
    const { svc, uploads } = makeStorage();
    const avatar = makeAvatarService(svc);
    const buffer = await jpegBuffer(800);

    const result = await avatar.processAndUpload('user-1', {
      buffer,
      mimetype: 'image/jpeg',
      size: buffer.length,
    });

    expect(uploads).toHaveLength(3);
    expect(new Set(uploads.map((u) => u.bucket))).toEqual(
      new Set(['majlis-uploads']),
    );
    expect(new Set(uploads.map((u) => u.contentType))).toEqual(
      new Set(['image/webp']),
    );
    for (const size of Object.keys(AVATAR_SIZES)) {
      expect(uploads.some((u) => u.key.endsWith(`/${size}.webp`))).toBe(true);
    }

    expect(result.urls.small).toMatch(/small\.webp$/);
    expect(result.urls.medium).toMatch(/medium\.webp$/);
    expect(result.urls.large).toMatch(/large\.webp$/);
    expect(result.primaryUrl).toBe(result.urls.medium);
  });

  it('rejects disallowed MIME types', async () => {
    const avatar = makeAvatarService(makeStorage().svc);
    await expect(
      avatar.processAndUpload('user-1', {
        buffer: Buffer.from('fake'),
        mimetype: 'image/gif',
        size: 4,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects files larger than MAX_BYTES', async () => {
    const avatar = makeAvatarService(makeStorage().svc);
    await expect(
      avatar.processAndUpload('user-1', {
        buffer: Buffer.alloc(1),
        mimetype: 'image/jpeg',
        size: AvatarService.MAX_BYTES + 1,
      }),
    ).rejects.toThrow(PayloadTooLargeException);
  });

  it('rejects images smaller than MIN_DIMENSION', async () => {
    const avatar = makeAvatarService(makeStorage().svc);
    const tiny = await jpegBuffer(64);
    await expect(
      avatar.processAndUpload('user-1', {
        buffer: tiny,
        mimetype: 'image/jpeg',
        size: tiny.length,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects non-image buffers that pass the MIME check', async () => {
    const avatar = makeAvatarService(makeStorage().svc);
    const junk = Buffer.from('not an image at all');
    await expect(
      avatar.processAndUpload('user-1', {
        buffer: junk,
        mimetype: 'image/jpeg',
        size: junk.length,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
