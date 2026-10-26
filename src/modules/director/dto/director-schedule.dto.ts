import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class DirectorScheduleQueryDto extends PaginationQueryDto {}

/**
 * Simplified director schedule response - shows sections and basic schedule info
 */
export class DirectorScheduleResponseDto {
  @ApiProperty({ example: 'Director Name' })
  ownerLabel!: string;

  @ApiProperty({ type: [Object] })
  days!: any[];
}