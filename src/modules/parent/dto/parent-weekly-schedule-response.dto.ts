import { ApiProperty } from '@nestjs/swagger';

export class WeeklyScheduleCourseDto {
  @ApiProperty({ example: 1 })
  courseId!: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: '1st Period' })
  sessionName!: string;

  @ApiProperty({ example: 1 })
  sessionPosition!: number;

  @ApiProperty({ example: 'Sara Ali Nasser', nullable: true })
  teacherName!: string | null;

  @ApiProperty({ example: null, nullable: true })
  note!: string | null;
}

export class WeeklyScheduleDayDto {
  @ApiProperty({ example: 'Monday' })
  dayName!: string;

  @ApiProperty({ example: 1 })
  position!: number;

  @ApiProperty({ type: [WeeklyScheduleCourseDto] })
  courses!: WeeklyScheduleCourseDto[];
}

export class ParentChildWeeklyScheduleDto {
  @ApiProperty({ example: 1 })
  studentId!: number;

  @ApiProperty({ example: 'Layla Ahmad Khalil' })
  studentName!: string;

  @ApiProperty({ example: 'A' })
  sectionName!: string;

  @ApiProperty({ example: '4' })
  class!: string;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiProperty({ type: [WeeklyScheduleDayDto] })
  days!: WeeklyScheduleDayDto[];
}

export class ParentWeeklyScheduleResponseDto {
  @ApiProperty({ type: [ParentChildWeeklyScheduleDto] })
  schedules!: ParentChildWeeklyScheduleDto[];
}
