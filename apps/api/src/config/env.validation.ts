import { plainToInstance } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  development = 'development',
  test = 'test',
  production = 'production',
}

export class EnvConfig {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.development;

  @IsNumberString()
  PORT: string = '3000';

  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @MinLength(16, {
    message: 'JWT_SECRET must be at least 16 characters (use a long random value)',
  })
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL: string = '15m';

  @IsOptional()
  @IsString()
  JWT_REFRESH_TTL: string = '30d';

  /**
   * HMAC key for hashing phone numbers before storage / logging.
   * Distinct from JWT_SECRET so rotating one doesn't invalidate the other.
   */
  @IsOptional()
  @IsString()
  @MinLength(16, {
    message: 'PHONE_HASH_SECRET must be at least 16 characters',
  })
  PHONE_HASH_SECRET: string = 'dev_phone_hash_secret_change_me';

  @IsBooleanString()
  LOCAL_OTP_MODE: string = 'true';

  @IsIn(['mock', 'agora'])
  AGORA_MODE: string = 'mock';

  @IsIn(['mock', 'live'])
  PAYMENTS_MODE: string = 'mock';

  @IsIn(['local', 'openai'])
  MODERATION_MODE: string = 'local';

  // ---- Object storage (MinIO locally, S3 in prod) ----

  @IsNotEmpty()
  S3_ENDPOINT!: string;

  @IsOptional()
  @IsString()
  S3_REGION: string = 'us-east-1';

  @IsNotEmpty()
  S3_ACCESS_KEY!: string;

  @IsNotEmpty()
  S3_SECRET_KEY!: string;

  @IsOptional()
  @IsString()
  S3_BUCKET_UPLOADS: string = 'majlis-uploads';

  @IsOptional()
  @IsString()
  S3_BUCKET_VOICE_CLIPS: string = 'majlis-voice-clips';

  @IsBooleanString()
  S3_FORCE_PATH_STYLE: string = 'true';

  /**
   * Base URL returned to clients for public objects. In docker, the API talks
   * to MinIO via `http://minio:9000`, but the Flutter client needs
   * `http://localhost:9000`. Leave unset to reuse S3_ENDPOINT.
   */
  @IsOptional()
  @IsString()
  S3_PUBLIC_URL?: string;

  /**
   * Shared secret for NestJS → realtime internal HTTP calls. Must match
   * REALTIME_INTERNAL_TOKEN on the realtime service. Optional so the API
   * still boots when realtime is unreachable (calls are best-effort).
   */
  @IsOptional()
  @IsString()
  REALTIME_INTERNAL_TOKEN?: string;
}

export function validateEnv(raw: Record<string, unknown>): EnvConfig {
  const config = plainToInstance(EnvConfig, raw, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length > 0) {
    const formatted = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${formatted}`);
  }
  return config;
}
