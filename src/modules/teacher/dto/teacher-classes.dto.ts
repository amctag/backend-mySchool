import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { TeacherScheduleResponseDto } from './teacher-schedule.dto';

export class TeacherClassesQueryDto extends PaginationQueryDto {}

export class TeacherClassSummaryDto {
  @ApiProperty({
    example: 5,
    description: 'Section id. The teacher app maps this to class_id.',
  })
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

  @ApiProperty({ example: true })
  isAssignedToCurrentTeacher!: boolean;
}

export class TeacherClassesResponseDto {
  @ApiProperty({ type: [TeacherClassSummaryDto] })
  items!: TeacherClassSummaryDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class TeacherStudentSummaryDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 'Layla Ahmad Khalil' })
  fullName!: string;

  @ApiProperty({ example: 1, description: 'Display order in the class roster' })
  seatNumber!: number;
}

export class TeacherClassRosterEntryDto {
  @ApiProperty({ example: 'Sara Ali Nasser' })
  teacherName!: string;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: true })
  isCurrentTeacher!: boolean;
}

export class TeacherClassDetailsResponseDto {
  @ApiProperty({ type: TeacherClassSummaryDto })
  summary!: TeacherClassSummaryDto;

  @ApiProperty({ type: [TeacherStudentSummaryDto] })
  students!: TeacherStudentSummaryDto[];

  @ApiProperty({ type: TeacherScheduleResponseDto })
  schedule!: TeacherScheduleResponseDto;

  @ApiProperty({ type: [TeacherClassRosterEntryDto] })
  roster!: TeacherClassRosterEntryDto[];
}
