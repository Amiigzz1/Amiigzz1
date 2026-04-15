import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

import { StorageService } from '../../storage/storage.service';

/** Output sizes (square, centered). Keys double as S3 path segments. */
export const AVATAR_SIZES = {
  small: 96,
  medium: 256,
  large: 512,
} as const;
export type AvatarSize = keyof typeof AVATAR_SIZES;

export interface AvatarUrls {
  small: string;
  medium: string;
  large: string;
}

export interface ProcessedAvatar {
  urls: AvatarUrls;
  /** The URL written to `users.avatar_url` — medium by default. */
  primaryUrl: string;
  /** A short version tag (based on content hash) for cache busting. */
  version: string;
}

@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);
  private readonly bucket: string;

  static readonly ALLOWED_MIMES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);
  static readonly MAX_BYTES = 5 * 1024 * 1024; // 5 MB
  static readonly MIN_DIMENSION = 128;
  static readonly MAX_DIMENSION = 4096;

  constructor(
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    this.bucket = config.get<string>('S3_BUCKET_UPLOADS') ?? 'majlis-uploads';
  }

  /**
   * Validate, strip metadata, resize into 3 WebP variants, and upload them.
   * Returns the public URLs + a short version tag.
   */
  async processAndUpload(
    userId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<ProcessedAvatar> {
    this.validateUpload(file);

    const meta = await sharp(file.buffer).metadata().catch(() => null);
    if (!meta || !meta.width || !meta.height) {
      throw new BadRequestException('avatar is not a valid image');
    }
    if (
      meta.width < AvatarService.MIN_DIMENSION ||
      meta.height < AvatarService.MIN_DIMENSION
    ) {
      throw new BadRequestException(
        `avatar must be at least ${AvatarService.MIN_DIMENSION}px on each side`,
      );
    }
    if (
      meta.width > AvatarService.MAX_DIMENSION ||
      meta.height > AvatarService.MAX_DIMENSION
    ) {
      throw new BadRequestException(
        `avatar must be at most ${AvatarService.MAX_DIMENSION}px on each side`,
      );
    }

    const version = Math.random().toString(36).slice(2, 8);
    const keyPrefix = `avatars/${userId}/${version}`;

    const uploads = await Promise.all(
      (Object.keys(AVATAR_SIZES) as AvatarSize[]).map(async (sizeKey) => {
        const px = AVATAR_SIZES[sizeKey];
        const body = await sharp(file.buffer)
          .rotate() // respect EXIF orientation, then drop EXIF
          .resize(px, px, { fit: 'cover', position: 'attention' })
          .webp({ quality: sizeKey === 'large' ? 82 : 78, effort: 4 })
          .toBuffer();

        const { url } = await this.storage.putObject({
          bucket: this.bucket,
          key: `${keyPrefix}/${sizeKey}.webp`,
          body,
          contentType: 'image/webp',
        });
        return [sizeKey, url] as const;
      }),
    );

    const urls = Object.fromEntries(uploads) as unknown as AvatarUrls;
    this.logger.log(`avatar uploaded user=${userId} version=${version}`);

    return {
      urls,
      primaryUrl: urls.medium,
      version,
    };
  }

  private validateUpload(file: {
    buffer: Buffer;
    mimetype: string;
    size: number;
  }): void {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('avatar file is required');
    }
    if (file.size > AvatarService.MAX_BYTES) {
      throw new PayloadTooLargeException(
        `avatar must be ≤ ${AvatarService.MAX_BYTES / 1024 / 1024} MB`,
      );
    }
    if (!AvatarService.ALLOWED_MIMES.has(file.mimetype)) {
      throw new BadRequestException(
        `avatar must be one of: ${[...AvatarService.ALLOWED_MIMES].join(', ')}`,
      );
    }
  }
}
