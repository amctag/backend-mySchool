import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateDashboardActivityDto {
  @ApiProperty({ example: 'Sports Day' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'Students will compete in track and football.' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;

  @ApiPropertyOptional({
    example: '2026-04-20',
    description: 'Activity date YYYY-MM-DD. Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/activities/sports-day.jpg',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(5000)
  image?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Limit to one academic year; omit for all school',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId?: number;
}
