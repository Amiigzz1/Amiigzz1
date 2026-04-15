import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AvatarService } from './avatar/avatar.service';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UserResponse } from './dto/user.response';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatar: AvatarService,
  ) {}

  async getMe(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('user not found');
    }
    return this.shape(user);
  }

  async updateMe(userId: string, dto: UpdateUserDto): Promise<UserResponse> {
    // Separate user-level fields from profile-level fields so we can update
    // each model in its own write.
    const userUpdate: Record<string, unknown> = {};
    if (dto.displayName !== undefined) userUpdate.displayName = dto.displayName;
    if (dto.language !== undefined) userUpdate.language = dto.language;
    if (dto.country !== undefined) userUpdate.country = dto.country;
    if (dto.birthdate !== undefined) userUpdate.birthdate = new Date(dto.birthdate);

    const profileUpdate: Record<string, unknown> = {};
    if (dto.bio !== undefined) profileUpdate.bio = dto.bio;
    if (dto.favoriteGames !== undefined)
      profileUpdate.favoriteGames = dto.favoriteGames;

    const [, updated] = await this.prisma.$transaction([
      this.prisma.userProfile.upsert({
        where: { userId },
        create: { userId, ...profileUpdate },
        update: profileUpdate,
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: userUpdate,
        include: { profile: true },
      }),
    ]);

    return this.shape(updated);
  }

  async uploadAvatar(
    userId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<UserResponse> {
    const processed = await this.avatar.processAndUpload(userId, file);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: processed.primaryUrl },
      include: { profile: true },
    });
    return this.shape(user);
  }

  /** Convert a Prisma row into the wire shape. */
  private shape(
    user: Awaited<
      ReturnType<PrismaService['user']['findUnique']>
    > & {
      profile: {
        bio: string | null;
        favoriteGames: string[];
        badges: string[];
        frameId: string | null;
        nameplateId: string | null;
      } | null;
    },
  ): UserResponse {
    return {
      id: user!.id,
      displayName: user!.displayName ?? null,
      avatarUrl: user!.avatarUrl ?? null,
      country: user!.country ?? null,
      language: user!.language,
      birthdate: user!.birthdate
        ? user!.birthdate.toISOString().slice(0, 10)
        : null,
      createdAt: user!.createdAt.toISOString(),
      profile: {
        bio: user!.profile?.bio ?? null,
        favoriteGames: user!.profile?.favoriteGames ?? [],
        badges: user!.profile?.badges ?? [],
        frameId: user!.profile?.frameId ?? null,
        nameplateId: user!.profile?.nameplateId ?? null,
      },
    };
  }
}
