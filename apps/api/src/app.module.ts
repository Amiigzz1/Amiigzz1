import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AgoraModule } from './agora/agora.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RedisModule } from './redis/redis.module';
import { RoomsModule } from './rooms/rooms.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (raw) => validateEnv(raw) as unknown as Record<string, unknown>,
    }),
    PrismaModule,
    RedisModule,
    CommonModule,
    StorageModule,
    AgoraModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    RoomsModule,
    HealthModule,
  ],
})
export class AppModule {}
