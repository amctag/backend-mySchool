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

export class DashboardRegistrationsQueryDto {
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
  classId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId?: number;

  @ApiPropertyOptional({
    description: 'Filter by student id (returns all years when yearId is omitted)',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId?: number;

  @ApiPropertyOptional({ example: 'Layla' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by student first name (contains, case-insensitive)',
    example: 'Layla',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Filter by student middle name (contains, case-insensitive)',
    example: 'Ahmad',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @ApiPropertyOptional({
    description: 'Filter by student last / family name (contains, case-insensitive)',
    example: 'Khalil',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    enum: ['id', 'student', 'class', 'section', 'year', 'date'],
    example: 'id',
  })
  @IsOptional()
  @Allow()
  @IsString()
  @IsIn(['id', 'student', 'class', 'section', 'year', 'date'])
  sortBy?: 'id' | 'student' | 'class' | 'section' | 'year' | 'date';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'asc' })
  @IsOptional()
  @Allow()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
