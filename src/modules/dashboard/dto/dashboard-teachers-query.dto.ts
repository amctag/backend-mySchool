import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { Allow, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class DashboardTeachersQueryDto {
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
    description: 'Filter by exact teacher id',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;

  @ApiPropertyOptional({
    description: 'Filter by teacher name (first, middle, or last name)',
    example: 'Khalil',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Search by teacher name, id, phone, or address',
    example: 'Ahmad',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Column to sort by',
    enum: ['id', 'name', 'phone', 'address', 'birthday'],
    example: 'id',
    default: 'id',
  })
  @IsOptional()
  @Allow()
  @IsString()
  @IsIn(['id', 'name', 'phone', 'address', 'birthday'])
  sortBy?: 'id' | 'name' | 'phone' | 'address' | 'birthday';

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
}
