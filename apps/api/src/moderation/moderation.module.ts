import { Module } from '@nestjs/common';

import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({
  providers: [ModerationService],
  controllers: [ModerationController],
  exports: [ModerationService],
})
export class ModerationModule {}
