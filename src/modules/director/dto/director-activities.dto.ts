import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class TeacherActivitiesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  date?: string;
}

export class TeacherActivityItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '2025-01-15' })
  date!: string;

  @ApiProperty({ example: 'Mathematics Fair' })
  title!: string;

  @ApiProperty({ example: 'An exhibition of student work in mathematics' })
  description!: string;

  @ApiProperty({ example: '2025-03-10' })
  startDate!: string;

  @ApiProperty({ example: '2025-03-12' })
  endDate!: string;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ type: [String], example: ['Grade 4', 'Grade 5'] })
  gradeLevels!: string[];

  @ApiProperty({ type: [String], example: ['4-A', '4-B'] })
  sectionTitles!: string[];

  @ApiProperty({ example: 'teacher-name' })
  createdBy!: string;

  @ApiProperty({ example: '2025-01-15T10:00:00.000Z' })
  createdAt!: string;
}

export class TeacherActivitiesResponseDto {
  @ApiProperty({ type: [TeacherActivityItemDto] })
  items!: TeacherActivityItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class UpsertTeacherActivityDto {
  @ApiProperty({ example: 'section_course' })
  @IsString()
  @IsIn(['section_course', 'section', 'class', 'stage'])
  scopeType!: string;

  @IsOptional() @IsInt() @Min(1)
  assignmentId?: number;
  @IsOptional() @IsInt() @Min(1)
  classId?: number;
  @IsOptional() @IsInt() @Min(1)
  schoolClassId?: number;
  @IsOptional() @IsInt() @Min(1)
  stageId?: number;
  @IsOptional() @IsString()
  stageTitle?: string;

  @ApiProperty({ example: 'Mathematics Fair' })
  @IsString()
  title!: string;

  @ApiProperty({ type: 'string', format: 'html', example: '<p>Description</p>' })
  @IsString()
  content!: string;

  @ApiProperty({ example: '2025-03-10' })
  @IsString()
  date!: string;

  @ApiProperty({ example: '2025-03-12' })
  @IsOptional() @IsString()
  image?: string;
}
