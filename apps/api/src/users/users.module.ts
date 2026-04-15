import { Module } from '@nestjs/common';

import { AvatarService } from './avatar/avatar.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService, AvatarService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
