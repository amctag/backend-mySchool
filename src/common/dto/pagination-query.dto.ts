import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Default number of records returned per page by paginated list endpoints.
 * Dashboard query DTOs cap `limit` at 100 (`@Max(100)`), so this is also the
 * maximum page size the API accepts.
 */
export const DEFAULT_PAGE_LIMIT = 100;

export class PaginationQueryDto {
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
    example: 100,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export function resolvePagination(query: {
  page?: number;
  limit?: number;
}): { page: number; limit: number; skip: number } {
  const page = query.page ?? 1;
  const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): { page: number; limit: number; total: number; totalPages: number } {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
