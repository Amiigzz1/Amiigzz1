import { IsOptional, IsString, Length } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Length(5, 20)
  phone!: string;

  /** ISO 3166-1 alpha-2, used as a parse hint when `phone` is national-format. */
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}
