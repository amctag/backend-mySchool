import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class TeacherTasksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  date?: string;
}

export class TeacherTaskItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '2025-01-15' })
  title!: string;

  @ApiProperty({ example: '2025-03-10' })
  dueDate!: string;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 'Grade 4' })
  gradeLevel!: string;

  @ApiProperty({ example: 'teacher-name' })
  createdBy!: string;

  @ApiProperty({ example: '2025-01-15T10:00:00.000Z' })
  createdAt!: string;
}

export class TeacherTasksResponseDto {
  @ApiProperty({ type: [TeacherTaskItemDto] })
  items!: TeacherTaskItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}