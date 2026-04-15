import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';

import { AgoraService } from '../agora/agora.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { CreateRoomDto } from './dto/create-room.dto';
import type { ListRoomsQuery } from './dto/list-rooms.query';
import type {
  PaginatedRooms,
  RoomDetail,
  RoomSummary,
} from './dto/room.response';

type RoomWithOwner = Prisma.RoomGetPayload<{
  include: {
    owner: {
      select: { id: true; displayName: true; avatarUrl: true };
    };
  };
}>;

@Injectable()
export class RoomsService {
  private readonly realtimeWsUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly agora: AgoraService,
    private readonly realtime: RealtimeService,
    config: ConfigService,
  ) {
    // Derived here so controllers stay free of env lookups.
    const realtimeHttp =
      config.get<string>('REALTIME_URL') ?? 'http://localhost:8080';
    this.realtimeWsUrl = realtimeHttp
      .replace(/^http:/, 'ws:')
      .replace(/^https:/, 'wss:');
  }

  async create(ownerId: string, dto: CreateRoomDto): Promise<RoomSummary> {
    const channel = this.agora.newChannelId();
    const created = await this.prisma.room.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        country: dto.country,
        maxSeats: dto.maxSeats ?? 8,
        agoraChannel: channel,
        ownerId,
      },
      include: {
        owner: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
    // Fire-and-forget: the realtime service EnsureRoom is idempotent, so a
    // retry on the next WS connect is fine if this call fails.
    void this.realtime.ensureRoom({
      id: created.id,
      ownerId: created.ownerId,
      maxSeats: created.maxSeats,
    });
    return this.toSummary(created);
  }

  async list(query: ListRoomsQuery): Promise<PaginatedRooms> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.RoomWhereInput = {
      closedAt: null,
      ...(query.category ? { category: query.category } : {}),
      ...(query.country ? { country: query.country } : {}),
    };

    // Rank by live activity then freshness. Rooms with speakers outrank
    // empty rooms, and within each bucket newer rooms come first.
    const [items, total] = await this.prisma.$transaction([
      this.prisma.room.findMany({
        where,
        orderBy: [
          { speakersLive: 'desc' },
          { listenersLive: 'desc' },
          { createdAt: 'desc' },
        ],
        take: pageSize,
        skip: (page - 1) * pageSize,
        include: {
          owner: {
            select: { id: true, displayName: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.room.count({ where }),
    ]);

    return {
      items: items.map((r) => this.toSummary(r)),
      page,
      pageSize,
      total,
    };
  }

  /**
   * Fetch room details AND mint an Agora token for the caller.
   * Room owners join as publishers; everyone else starts as an audience
   * member and upgrades to publisher when they take a seat (Phase 2b).
   */
  async getById(userId: string, roomId: string): Promise<RoomDetail> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        owner: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
    if (!room || room.closedAt) {
      throw new NotFoundException('room not found');
    }
    if (room.locked && room.ownerId !== userId) {
      throw new ForbiddenException('room is locked');
    }

    const join = this.agora.issueJoinToken({
      channel: room.agoraChannel,
      userId,
      role: room.ownerId === userId ? 'publisher' : 'audience',
    });

    return {
      ...this.toSummary(room),
      agoraChannel: room.agoraChannel,
      join,
      realtimeWsUrl: this.realtimeWsUrl,
    };
  }

  async closeIfOwner(userId: string, roomId: string): Promise<void> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { ownerId: true, closedAt: true },
    });
    if (!room) throw new NotFoundException('room not found');
    if (room.ownerId !== userId) {
      throw new ForbiddenException('only the owner can close this room');
    }
    if (room.closedAt) return;
    await this.prisma.room.update({
      where: { id: roomId },
      data: { closedAt: new Date() },
    });
  }

  private toSummary(row: RoomWithOwner): RoomSummary {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      country: row.country,
      maxSeats: row.maxSeats,
      locked: row.locked,
      listenersLive: row.listenersLive,
      speakersLive: row.speakersLive,
      owner: {
        id: row.owner.id,
        displayName: row.owner.displayName,
        avatarUrl: row.owner.avatarUrl,
      },
      createdAt: row.createdAt.toISOString(),
    };
  }
}
