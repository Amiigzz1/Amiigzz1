import { Country, Language } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 48)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 240)
  bio?: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @IsOptional()
  @IsEnum(Country)
  country?: Country;

  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  favoriteGames?: string[];
}
