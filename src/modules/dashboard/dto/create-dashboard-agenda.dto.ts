import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateDashboardAgendaDto {
  @ApiProperty({ example: 'Fractions practice' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'Complete exercises 1–10 on page 42.' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ example: '2026-09-04' })
  @IsDateString()
  agendaDate!: string;

  @ApiProperty({ example: '09:00' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  time!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId!: number;

  @ApiProperty({ type: [Number], example: [1] })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  sectionIds!: number[];

  @ApiPropertyOptional({ example: 'https://cdn.example.com/agendas/hw.jpg' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  imageLink?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/agendas/hw.pdf' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  fileLink?: string;

  @ApiPropertyOptional({ example: 1, description: '1 = active, 0 = inactive' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}
