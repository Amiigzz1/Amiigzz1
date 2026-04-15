import { Module } from '@nestjs/common';

import { GiftsController } from './gifts.controller';
import { GiftsService } from './gifts.service';

@Module({
  providers: [GiftsService],
  controllers: [GiftsController],
  exports: [GiftsService],
})
export class GiftsModule {}
