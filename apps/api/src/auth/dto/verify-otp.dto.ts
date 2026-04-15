import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Length(5, 20)
  phone!: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  deviceId?: string;
}
