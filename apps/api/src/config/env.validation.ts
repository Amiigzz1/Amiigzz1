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
