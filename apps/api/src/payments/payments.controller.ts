import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { PaymentsService } from './payments.service';

class CheckoutDto {
  @IsString()
  packageId!: string;

  @IsIn(['mock', 'tap', 'fawry', 'iap_apple', 'iap_google'])
  provider!: 'mock' | 'tap' | 'fawry' | 'iap_apple' | 'iap_google';
}

class WebhookDto {
  @IsString()
  providerRef!: string;

  @IsIn(['succeeded', 'failed'])
  status!: 'succeeded' | 'failed';
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('packages')
  @UseGuards(JwtAuthGuard)
  packages(): ReturnType<PaymentsService['listPackages']> {
    return this.payments.listPackages();
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckoutDto,
  ): Promise<{ paymentId: string; checkoutUrl: string | null; provider: string }> {
    return this.payments.checkout({
      userId: user.id,
      packageId: dto.packageId,
      provider: dto.provider,
    });
  }

  @Post('mock-confirm/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  mockConfirm(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.payments.confirmMock(id);
  }

  // Webhook endpoints (no JWT; real signature verification lands in prod).
  @Post('webhooks/tap')
  @HttpCode(HttpStatus.NO_CONTENT)
  webhookTap(@Body() dto: WebhookDto): Promise<void> {
    // TODO(prod): verify Tap HMAC before fulfilling.
    return this.payments.handleWebhook('tap', dto);
  }

  @Post('webhooks/fawry')
  @HttpCode(HttpStatus.NO_CONTENT)
  webhookFawry(@Body() dto: WebhookDto): Promise<void> {
    // TODO(prod): verify Fawry security checksum.
    return this.payments.handleWebhook('fawry', dto);
  }
}
