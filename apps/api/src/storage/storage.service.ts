import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PutObjectInput {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}

/**
 * Thin wrapper over `@aws-sdk/client-s3` tuned for local MinIO and production
 * S3. Handles the classic "internal endpoint vs. public URL" split: inside
 * docker the API talks to `http://minio:9000`, but the URL returned to the
 * mobile app must be reachable from the phone (e.g. `http://localhost:9000`).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly publicBase: string;
  private readonly forcePathStyle: boolean;

  constructor(config: ConfigService) {
    const endpoint = config.getOrThrow<string>('S3_ENDPOINT');
    const region = config.get<string>('S3_REGION') ?? 'us-east-1';
    const accessKey = config.getOrThrow<string>('S3_ACCESS_KEY');
    const secretKey = config.getOrThrow<string>('S3_SECRET_KEY');
    this.forcePathStyle =
      (config.get<string>('S3_FORCE_PATH_STYLE') ?? 'true') === 'true';
    const configuredPublic = config.get<string>('S3_PUBLIC_URL');
    this.publicBase = (configuredPublic && configuredPublic.length > 0
      ? configuredPublic
      : endpoint
    ).replace(/\/+$/, '');

    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle: this.forcePathStyle,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
  }

  async putObject(input: PutObjectInput): Promise<{ url: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl ?? 'public, max-age=31536000, immutable',
      }),
    );
    return { url: this.publicUrl(input.bucket, input.key) };
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
    } catch (err) {
      // Never let a failed cleanup break a foreground request.
      this.logger.warn(`delete failed bucket=${bucket} key=${key}: ${err}`);
    }
  }

  /** Returns a short-lived URL for authenticated downloads (non-public objects). */
  async presignGetUrl(
    bucket: string,
    key: string,
    ttlSeconds = 5 * 60,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  /** Canonical public URL for a (bucket, key) pair — honors path-style layout. */
  publicUrl(bucket: string, key: string): string {
    return this.forcePathStyle
      ? `${this.publicBase}/${bucket}/${key}`
      : `${this.publicBase.replace(/^(https?:\/\/)/, `$1${bucket}.`)}/${key}`;
  }
}
