import { IsOptional, IsString, Length } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @Length(10, 512)
  refreshToken!: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  deviceId?: string;
}
