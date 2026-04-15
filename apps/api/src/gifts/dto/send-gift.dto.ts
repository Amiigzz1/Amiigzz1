import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class SendGiftDto {
  @IsUUID()
  recipientId!: string;

  @IsString()
  giftId!: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;
}
