import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { AvatarService } from './avatar/avatar.service';
import { UpdateUserDto } from './dto/update-user.dto';
import type { UserResponse } from './dto/user.response';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() auth: AuthenticatedUser): Promise<UserResponse> {
    return this.users.getMe(auth.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() auth: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponse> {
    return this.users.updateMe(auth.id, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: AvatarService.MAX_BYTES },
    }),
  )
  uploadAvatar(
    @CurrentUser() auth: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserResponse> {
    return this.users.uploadAvatar(auth.id, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    });
  }
}
