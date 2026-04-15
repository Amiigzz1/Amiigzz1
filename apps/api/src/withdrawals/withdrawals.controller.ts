import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsString,
} from 'class-validator';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { WithdrawalsService } from './withdrawals.service';

class RequestDto {
  @IsString()
  @IsNotEmpty()
  diamonds!: string; // sent as string to preserve precision

  @IsIn(['stc_pay', 'bank_transfer', 'paypal', 'wise'])
  method!: string;

  @IsObject()
  methodDetails!: Record<string, unknown>;
}

@Controller('withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Post()
  async request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestDto,
  ): Promise<{ id: string; amountUsd: string; status: string }> {
    const diamonds = BigInt(dto.diamonds);
    return this.withdrawals.request({
      userId: user.id,
      diamonds,
      method: dto.method,
      // Prisma's InputJsonValue is narrower than Record; the payload is
      // user-supplied JSON so the cast is safe here.
      methodDetails: dto.methodDetails as never,
    });
  }

  @Get('me')
  list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<
    Array<{
      id: string;
      diamonds: string;
      amountUsd: string;
      method: string;
      status: string;
      requestedAt: string;
    }>
  > {
    return this.withdrawals.listForUser(user.id);
  }
}
