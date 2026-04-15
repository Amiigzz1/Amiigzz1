import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { SendGiftDto } from './dto/send-gift.dto';
import { GiftsService } from './gifts.service';

@Controller('gifts')
@UseGuards(JwtAuthGuard)
export class GiftsController {
  constructor(private readonly gifts: GiftsService) {}

  @Get()
  async catalog(): Promise<
    Array<{
      id: string;
      nameAr: string;
      nameEn: string;
      priceCoins: string;
      animationUrl: string | null;
      category: string;
    }>
  > {
    const rows = await this.gifts.listCatalog();
    return rows.map((r) => ({
      id: r.id,
      nameAr: r.nameAr,
      nameEn: r.nameEn,
      priceCoins: r.priceCoins.toString(),
      animationUrl: r.animationUrl,
      category: r.category,
    }));
  }

  @Post('send')
  async send(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendGiftDto,
  ): Promise<{
    giftSendId: string;
    totalCoins: string;
    totalDiamonds: string;
    senderCoins: string;
  }> {
    const result = await this.gifts.send({
      senderId: user.id,
      recipientId: dto.recipientId,
      giftId: dto.giftId,
      roomId: dto.roomId,
      quantity: dto.quantity ?? 1,
    });
    return {
      giftSendId: result.giftSendId,
      totalCoins: result.totalCoins.toString(),
      totalDiamonds: result.totalDiamonds.toString(),
      senderCoins: result.sender.coins.toString(),
    };
  }
}
