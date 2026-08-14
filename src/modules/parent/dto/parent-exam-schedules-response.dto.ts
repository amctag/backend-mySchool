import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ParentExamScheduleCourseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 1 })
  position!: number;

  @ApiProperty({ example: '09:00', description: 'Exam start time' })
  startTime!: string;

  @ApiProperty({ example: 90, description: 'Exam duration in minutes' })
  duration!: number;

  @ApiPropertyOptional({ example: 'Bring calculator', nullable: true })
  note!: string | null;
}

export class ParentExamScheduleDateDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '2026-06-10' })
  date!: string;

  @ApiProperty({ type: [ParentExamScheduleCourseDto] })
  exams!: ParentExamScheduleCourseDto[];
}

export class ParentExamScheduleItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Midterm Exams 2026' })
  title!: string;

  @ApiProperty({ example: 'Midterm' })
  gradeTypeTitle!: string;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiPropertyOptional({ example: 'Please arrive 15 minutes early.', nullable: true })
  note!: string | null;

  @ApiProperty({ type: [ParentExamScheduleDateDto] })
  dates!: ParentExamScheduleDateDto[];
}

export class ParentStudentExamSchedulesDto {
  @ApiProperty({ example: 1 })
  studentId!: number;

  @ApiProperty({ example: 'Layla Ahmad Khalil' })
  studentName!: string;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: '4A' })
  className!: string;

  @ApiProperty({ example: 'A' })
  sectionName!: string;

  @ApiProperty({ type: [ParentExamScheduleItemDto] })
  examSchedules!: ParentExamScheduleItemDto[];
}

export class ParentExamSchedulesResponseDto {
  @ApiProperty({ type: [ParentStudentExamSchedulesDto] })
  students!: ParentStudentExamSchedulesDto[];
}

export class ParentExamScheduleDetailResponseDto extends ParentExamScheduleItemDto {
  @ApiProperty({ example: 1 })
  studentId!: number;

  @ApiProperty({ example: 'Layla Ahmad Khalil' })
  studentName!: string;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: '4A' })
  className!: string;

  @ApiProperty({ example: 'A' })
  sectionName!: string;
}
