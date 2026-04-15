import { Module } from '@nestjs/common';

import { GamesController } from './games.controller';
import { GamesService } from './games.service';

@Module({
  providers: [GamesService],
  controllers: [GamesController],
})
export class GamesModule {}
