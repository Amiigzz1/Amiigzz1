import { Country, RoomCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListRoomsQuery {
  @IsOptional()
  @IsEnum(RoomCategory)
  category?: RoomCategory;

  @IsOptional()
  @IsEnum(Country)
  country?: Country;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;
}
