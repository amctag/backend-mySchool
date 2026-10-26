import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class DirectorGradesQueryDto extends PaginationQueryDto {}

/**
 * Simplified director grade entry context dto
 */
export class DirectorGradeEntryContextDto {
  @ApiProperty({ example: 1 })
  sectionId!: number;

  @ApiProperty({ example: 1 })
  courseId!: number;

  @ApiProperty({ example: 'Quiz' })
  gradeType!: string | null;

  @ApiProperty({ type: [Object] })
  students!: any[];
}