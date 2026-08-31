import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardExamScheduleExamDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  courseId!: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 1 })
  position!: number;

  @ApiProperty({ example: '09:00' })
  startTime!: string;

  @ApiProperty({ example: 90 })
  duration!: number;

  @ApiProperty({ example: 'Room 204', nullable: true })
  note!: string | null;
}

export class DashboardExamScheduleDateDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '2026-06-10' })
  date!: string;

  @ApiProperty({ type: [DashboardExamScheduleExamDto] })
  exams!: DashboardExamScheduleExamDto[];
}

export class DashboardExamScheduleDetailResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Midterm Exams 2026' })
  title!: string;

  @ApiProperty({ example: 1 })
  classId!: number;

  @ApiProperty({ example: 'Grade 4' })
  className!: string;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2026-2027' })
  yearTitle!: string;

  @ApiProperty({ example: 1 })
  gradeTypeId!: number;

  @ApiProperty({ example: 'Midterm' })
  gradeTypeTitle!: string;

  @ApiPropertyOptional({ example: 'Please arrive 15 minutes early.' })
  note!: string | null;

  @ApiProperty({ type: [DashboardExamScheduleDateDto] })
  dates!: DashboardExamScheduleDateDto[];
}
