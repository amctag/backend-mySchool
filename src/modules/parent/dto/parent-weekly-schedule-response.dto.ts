import { ApiProperty } from '@nestjs/swagger';

export class WeeklyScheduleSessionDto {
  @ApiProperty({ example: 1 })
  sessionId: number;

  @ApiProperty({ example: '1st Period' })
  sessionName: string;

  @ApiProperty({ example: 1 })
  position: number;

  @ApiProperty({ example: 1 })
  courseId: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle: string;

  @ApiProperty({ example: 'Sara Ali Nasser', nullable: true })
  teacherName: string | null;

  @ApiProperty({ example: null, nullable: true })
  note: string | null;
}

export class WeeklyScheduleDayDto {
  @ApiProperty({ example: 1 })
  dayId: number;

  @ApiProperty({ example: 'Monday' })
  dayName: string;

  @ApiProperty({ example: 1 })
  position: number;

  @ApiProperty({ type: [WeeklyScheduleSessionDto] })
  sessions: WeeklyScheduleSessionDto[];
}

export class WeeklyScheduleSectionDto {
  @ApiProperty({ example: 1 })
  sectionId: number;

  @ApiProperty({ example: '4A' })
  className: string;

  @ApiProperty({ example: 'Section A' })
  sectionTitle: string;

  @ApiProperty({ example: '2025-2026' })
  yearTitle: string;

  @ApiProperty({ example: 1 })
  schoolId: number;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName: string;
}

export class ParentChildWeeklyScheduleDto {
  @ApiProperty({ example: 1 })
  studentId: number;

  @ApiProperty({ example: 'Layla Ahmad Khalil' })
  studentName: string;

  @ApiProperty({ example: 1, nullable: true })
  scheduleId: number | null;

  @ApiProperty({ type: WeeklyScheduleSectionDto, nullable: true })
  section: WeeklyScheduleSectionDto | null;

  @ApiProperty({ type: [WeeklyScheduleDayDto] })
  days: WeeklyScheduleDayDto[];
}

export class ParentWeeklyScheduleResponseDto {
  @ApiProperty({ type: [ParentChildWeeklyScheduleDto] })
  schedules: ParentChildWeeklyScheduleDto[];
}
