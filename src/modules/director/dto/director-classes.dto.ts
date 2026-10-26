import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class DirectorClassesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'School year id. Defaults to the current year.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId?: number;
}

export class DirectorClassSummaryDto {
  @ApiProperty({ example: 5 })
  id!: number;

  @ApiProperty({ example: 'Grade 4' })
  className!: string;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiProperty({ example: 'Primary' })
  stage!: string;

  @ApiProperty({ example: 'Mathematics' })
  primaryCourseTitle!: string;

  @ApiProperty({ type: [String], example: ['Mathematics', 'Science'] })
  courseTitles!: string[];

  @ApiProperty({ example: 24 })
  studentCount!: number;

  @ApiProperty({ example: true })
  isAssignedToCurrentDirector!: boolean;
}

export class DirectorClassesResponseDto {
  @ApiProperty({ type: [DirectorClassSummaryDto] })
  items!: DirectorClassSummaryDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class DirectorClassStudentsResponseDto {
  @ApiProperty({ example: 5 })
  classId!: number;

  @ApiProperty({ example: 'Grade 4 - Section A' })
  classLabel!: string;

  @ApiProperty({ example: 24 })
  studentCount!: number;

  @ApiProperty({ type: [Object] })
  students!: any[];
}

export class DirectorClassDetailsResponseDto {
  @ApiProperty({ type: DirectorClassSummaryDto })
  summary!: DirectorClassSummaryDto;

  @ApiProperty({ type: [Object] })
  students!: any[];

  @ApiProperty({ type: Object })
  schedule!: any;

  @ApiProperty({ type: [Object] })
  roster!: any[];
}