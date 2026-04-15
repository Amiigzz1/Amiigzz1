import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ReportTargetType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ModerationService } from './moderation.service';

class FileReportDto {
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @IsString()
  @Length(1, 128)
  targetId!: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsString()
  @Length(1, 32)
  category!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  details?: string;
}

class AppealDto {
  @IsUUID()
  actionId!: string;

  @IsString()
  @Length(1, 500)
  reason!: string;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post('reports')
  fileReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FileReportDto,
  ): Promise<{ id: string; status: string }> {
    return this.moderation.fileReport({
      reporterId: user.id,
      targetType: dto.targetType,
      targetId: dto.targetId,
      roomId: dto.roomId,
      category: dto.category,
      details: dto.details,
    });
  }

  @Post('appeals')
  async fileAppeal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AppealDto,
  ): Promise<{ id: string }> {
    return this.moderation.fileAppeal(user.id, dto.actionId, dto.reason);
  }
}
