import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { Allow, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class DashboardParentsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (starts at 1)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by exact parent id',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;

  @ApiPropertyOptional({
    description: 'Filter by parent name (first, middle, or last name)',
    example: 'Khalil',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Filter by first name (contains, case-insensitive)',
    example: 'Ahmad',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Filter by middle name (contains, case-insensitive)',
    example: 'Ali',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @ApiPropertyOptional({
    description: 'Filter by last / family name (contains, case-insensitive)',
    example: 'Khalil',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Search by parent name or parent id',
    example: 'Ahmad',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Column to sort by',
    enum: ['id', 'name', 'address', 'phone', 'childrenCount'],
    example: 'id',
    default: 'id',
  })
  @IsOptional()
  @Allow()
  @IsString()
  @IsIn(['id', 'name', 'address', 'phone', 'childrenCount'])
  sortBy?: 'id' | 'name' | 'address' | 'phone' | 'childrenCount';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    example: 'asc',
    default: 'asc',
  })
  @IsOptional()
  @Allow()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Filter by person status. Omit for all.',
    enum: ['active', 'closed'],
    example: 'active',
  })
  @IsOptional()
  @Allow()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(['active', 'closed'])
  status?: 'active' | 'closed';

  @ApiPropertyOptional({
    description: 'Filter by payment flag. Omit for all.',
    enum: ['paid', 'unpaid'],
    example: 'paid',
  })
  @IsOptional()
  @Allow()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(['paid', 'unpaid'])
  paid?: 'paid' | 'unpaid';

  @ApiPropertyOptional({
    description:
      'Filter by exact number of children in this school. Omit for all.',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  childrenCount?: number;

  @ApiPropertyOptional({
    description:
      'Filter by minimum number of children in this school (inclusive). Omit for all.',
    example: 6,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  childrenCountMin?: number;
}

export class DashboardParentOptionsQueryDto {
  @ApiPropertyOptional({
    description: 'Match first, middle, or last name',
    example: 'Khalil',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;
}
