import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class TeacherAssignmentsQueryDto extends PaginationQueryDto {}

export class TeacherScheduleQueryDto {
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

export class TeacherAssignmentItemDto {
  @ApiProperty({ example: 12, description: 'Teach assignment id' })
  id!: number;

  @ApiProperty({
    example: 5,
    description: 'Section id. The teacher app maps this to class_id.',
  })
  classId!: number;

  @ApiProperty({ example: 'Grade 4' })
  className!: string;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiProperty({ example: 'Primary' })
  stage!: string;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 'Monday' })
  dayName!: string;

  @ApiProperty({ example: 1 })
  periodNumber!: number;

  @ApiProperty({ example: 'Period 1' })
  periodLabel!: string;

  @ApiProperty({ example: '08:00' })
  startTime!: string;

  @ApiProperty({ example: '08:45' })
  endTime!: string;

  @ApiProperty({ example: '' })
  room!: string;
}

export class TeacherAssignmentsResponseDto {
  @ApiProperty({ type: [TeacherAssignmentItemDto] })
  items!: TeacherAssignmentItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class TeacherScheduleEntryDto {
  @ApiProperty({ example: 12 })
  assignmentId!: number;

  @ApiProperty({ example: 5 })
  classId!: number;

  @ApiProperty({ example: 'Grade 4 - Section A' })
  classLabel!: string;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 1 })
  periodNumber!: number;

  @ApiProperty({ example: 'Period 1' })
  periodLabel!: string;

  @ApiProperty({ example: '08:00' })
  startTime!: string;

  @ApiProperty({ example: '08:45' })
  endTime!: string;

  @ApiProperty({ example: '' })
  room!: string;
}

export class TeacherScheduleDayDto {
  @ApiProperty({ example: 'Monday' })
  dayName!: string;

  @ApiProperty({ example: 1 })
  position!: number;

  @ApiProperty({ type: [TeacherScheduleEntryDto] })
  entries!: TeacherScheduleEntryDto[];
}

export class TeacherScheduleResponseDto {
  @ApiProperty({ example: 'Sara Ali Nasser' })
  ownerLabel!: string;

  @ApiProperty({ type: [TeacherScheduleDayDto] })
  days!: TeacherScheduleDayDto[];
}
