import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateRoomDto } from './dto/create-room.dto';
import { ListRoomsQuery } from './dto/list-rooms.query';
import type {
  PaginatedRooms,
  RoomDetail,
  RoomSummary,
} from './dto/room.response';
import { RoomsService } from './rooms.service';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRoomDto,
  ): Promise<RoomSummary> {
    return this.rooms.create(user.id, dto);
  }

  @Get()
  list(@Query() query: ListRoomsQuery): Promise<PaginatedRooms> {
    return this.rooms.list(query);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RoomDetail> {
    return this.rooms.getById(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.rooms.closeIfOwner(user.id, id);
  }
}
