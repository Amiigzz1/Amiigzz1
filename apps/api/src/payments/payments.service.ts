import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, TxType } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { COIN_PACKAGES, findPackage } from './coin-packages';

export interface CheckoutInput {
  userId: string;
  packageId: string;
  provider: 'mock' | 'tap' | 'fawry' | 'iap_apple' | 'iap_google';
}

export interface CheckoutResult {
  paymentId: string;
  checkoutUrl: string | null; // null for IAP / mock
  provider: string;
}

/**
 * PaymentsService
 * ---------------
 * Provider-agnostic payments layer.
 *
 * Providers (all stubbed in local mode):
 *   - mock: flip `status=succeeded` instantly via confirmMock; useful for
 *     manual dev walkthroughs and integration tests.
 *   - tap / fawry: checkout URL is served by the provider; webhook posts
 *     to `handleWebhook` with the HMAC-verified payload. Real signature
 *     verification lands before the prod rollout.
 *   - iap_apple / iap_google: receipts verified against StoreKit / Play
 *     Billing; tokens arrive from the mobile client, not a webhook.
 *
 * Fulfillment is idempotent: the (provider, providerRef) unique index
 * guarantees no double-credit even if a webhook retries.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly mode: 'mock' | 'live';

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    config: ConfigService,
  ) {
    this.mode = (config.get<string>('PAYMENTS_MODE') ?? 'mock') as 'mock' | 'live';
  }

  listPackages(): ReturnType<typeof normalizePackage>[] {
    return COIN_PACKAGES.map(normalizePackage);
  }

  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const pkg = findPackage(input.packageId);
    if (!pkg) throw new NotFoundException('package not found');
    if (input.provider !== 'mock' && this.mode === 'mock') {
      throw new BadRequestException(
        'PAYMENTS_MODE=mock — use provider=mock while keys are unset',
      );
    }

    const providerRef = randomUUID();
    const payment = await this.prisma.payment.create({
      data: {
        userId: input.userId,
        packageId: pkg.id,
        coinsGranted: pkg.coins + pkg.bonusCoins,
        amount: pkg.priceUsd,
        currency: pkg.currency,
        provider: input.provider,
        providerRef,
        status: PaymentStatus.pending,
        metadata: { coins: pkg.coins.toString(), bonus: pkg.bonusCoins.toString() },
      },
    });

    // In mock mode we hand back a URL that the dev can hit to confirm.
    const checkoutUrl =
      input.provider === 'mock'
        ? `mock://confirm/${payment.id}`
        : null; // TODO(prod): return provider-issued URL.

    return {
      paymentId: payment.id,
      checkoutUrl,
      provider: input.provider,
    };
  }

  /**
   * Mock confirmation — flips a pending mock payment to succeeded and
   * credits coins. Real providers hit handleWebhook instead.
   */
  async confirmMock(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('payment not found');
    if (payment.provider !== 'mock') {
      throw new BadRequestException('use the provider webhook for non-mock payments');
    }
    if (payment.status === PaymentStatus.succeeded) return;

    await this.fulfill(payment.id);
  }

  /**
   * Webhook entry for real providers. Caller must have already verified
   * the HMAC; this method assumes the body is trustworthy.
   */
  async handleWebhook(
    provider: 'tap' | 'fawry' | 'iap_apple' | 'iap_google',
    body: { providerRef: string; status: 'succeeded' | 'failed' },
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: {
        provider_providerRef: { provider, providerRef: body.providerRef },
      },
    });
    if (!payment) {
      this.logger.warn(`webhook for unknown payment ${provider}:${body.providerRef}`);
      return;
    }
    if (body.status === 'failed') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.failed, settledAt: new Date() },
      });
      return;
    }
    await this.fulfill(payment.id);
  }

  private async fulfill(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) return;
    if (payment.status === PaymentStatus.succeeded) return;

    await this.wallet.mutate({
      userId: payment.userId,
      type: TxType.purchase,
      coinsDelta: payment.coinsGranted,
      refId: `payment-${payment.id}`,
      metadata: { provider: payment.provider, packageId: payment.packageId },
    });
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.succeeded, settledAt: new Date() },
    });
    this.logger.log(
      `payment ${payment.id} fulfilled for user ${payment.userId} ` +
        `(+${payment.coinsGranted} coins)`,
    );
  }
}

function normalizePackage(p: (typeof COIN_PACKAGES)[number]): {
  id: string;
  coins: string;
  bonusCoins: string;
  priceUsd: string;
  currency: string;
} {
  return {
    id: p.id,
    coins: p.coins.toString(),
    bonusCoins: p.bonusCoins.toString(),
    priceUsd: p.priceUsd,
    currency: p.currency,
  };
}
