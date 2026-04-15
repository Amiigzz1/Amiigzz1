import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedUser } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(
    @Body() dto: RequestOtpDto,
  ): Promise<{ status: 'sent'; devCode?: string }> {
    const { devCode } = await this.auth.requestOtp(dto.phone, dto.country);
    return devCode !== undefined
      ? { status: 'sent', devCode }
      : { status: 'sent' };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
  ): Promise<{
    accessToken: string;
    accessTokenExpiresIn: number;
    refreshToken: string;
    userId: string;
    isNewUser: boolean;
  }> {
    const result = await this.auth.verifyOtp(dto.phone, dto.code, {
      countryHint: dto.country,
      deviceId: dto.deviceId,
      userAgent: req.get('user-agent') ?? undefined,
      ip: req.ip,
    });
    return {
      accessToken: result.tokens.accessToken,
      accessTokenExpiresIn: result.tokens.accessTokenExpiresIn,
      refreshToken: result.tokens.refreshToken,
      userId: result.userId,
      isNewUser: result.isNewUser,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<{
    accessToken: string;
    accessTokenExpiresIn: number;
    refreshToken: string;
  }> {
    const pair = await this.auth.refresh(dto.refreshToken, {
      deviceId: dto.deviceId,
      userAgent: req.get('user-agent') ?? undefined,
      ip: req.ip,
    });
    return {
      accessToken: pair.accessToken,
      accessTokenExpiresIn: pair.accessTokenExpiresIn,
      refreshToken: pair.refreshToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() _user: AuthenticatedUser,
    @Body() dto: RefreshTokenDto,
  ): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }
}
