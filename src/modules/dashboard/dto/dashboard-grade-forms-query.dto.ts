import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class DashboardGradeFormsQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId?: number;

  @ApiPropertyOptional({ example: 'Report' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    enum: ['id', 'title', 'year', 'direction', 'tableFormat', 'status', 'date'],
    example: 'id',
  })
  @IsOptional()
  @Allow()
  @IsString()
  @IsIn(['id', 'title', 'year', 'direction', 'tableFormat', 'status', 'date'])
  sortBy?:
    | 'id'
    | 'title'
    | 'year'
    | 'direction'
    | 'tableFormat'
    | 'status'
    | 'date';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'desc' })
  @IsOptional()
  @Allow()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
