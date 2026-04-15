import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  async get(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ coins: string; diamonds: string }> {
    const snapshot = await this.wallet.getOrCreate(user.id);
    // BigInt isn't JSON-serializable out of the box — we stringify on the way
    // out so clients using the raw API don't trip over it.
    return {
      coins: snapshot.coins.toString(),
      diamonds: snapshot.diamonds.toString(),
    };
  }
}
