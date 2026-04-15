import { Controller, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { GamesService } from './games.service';

@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Post('ludo/quick-match')
  quickMatch(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ gameId: string; roomUrl: string; state: unknown }> {
    return this.games.quickMatchLudo(user.id);
  }
}
