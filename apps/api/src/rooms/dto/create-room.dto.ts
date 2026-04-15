import { Country, RoomCategory } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @Length(2, 64)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  description?: string;

  @IsEnum(RoomCategory)
  category!: RoomCategory;

  @IsOptional()
  @IsEnum(Country)
  country?: Country;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(12)
  maxSeats?: number;
}
