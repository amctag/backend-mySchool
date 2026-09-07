import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateDashboardNoticeDto {
  @ApiProperty({ example: 'Please submit the medical form by Friday.' })
  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  description!: string;

  @ApiPropertyOptional({
    example: '2026-09-07',
    description: 'Notice date YYYY-MM-DD. Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: 1, description: 'Optional notice type' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  noticeTypeId?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Limit to one section; omit with no students for all school',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId?: number;

  @ApiPropertyOptional({
    type: [Number],
    example: [12, 15],
    description: 'Target specific students; omit for section or all school',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  studentIds?: number[];
}
