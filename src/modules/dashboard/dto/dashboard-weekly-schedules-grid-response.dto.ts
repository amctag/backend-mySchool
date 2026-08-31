import { ApiProperty } from '@nestjs/swagger';

export class DashboardWeeklyScheduleGridDayDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Monday' })
  dayName!: string;

  @ApiProperty({ example: 1 })
  position!: number;
}

export class DashboardWeeklyScheduleGridSessionDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '1st Period' })
  sessionName!: string;

  @ApiProperty({ example: 1 })
  position!: number;
}

export class DashboardWeeklyScheduleGridCellDto {
  @ApiProperty({ example: 1 })
  dayId!: number;

  @ApiProperty({ example: 1 })
  sessionId!: number;

  @ApiProperty({ example: 5, nullable: true })
  detailId!: number | null;

  @ApiProperty({ example: 2, nullable: true })
  courseId!: number | null;

  @ApiProperty({ example: 'Mathematics', nullable: true })
  courseTitle!: string | null;

  @ApiProperty({ example: 1, nullable: true })
  personId!: number | null;

  @ApiProperty({ example: 'Sara Ali Nasser', nullable: true })
  createdByName!: string | null;
}

export class DashboardWeeklyScheduleGridResponseDto {
  @ApiProperty({ example: 1, nullable: true })
  scheduleId!: number | null;

  @ApiProperty({ example: '2026-2027' })
  yearTitle!: string;

  @ApiProperty({ example: 'Grade 4' })
  className!: string;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ type: [DashboardWeeklyScheduleGridDayDto] })
  days!: DashboardWeeklyScheduleGridDayDto[];

  @ApiProperty({ type: [DashboardWeeklyScheduleGridSessionDto] })
  sessions!: DashboardWeeklyScheduleGridSessionDto[];

  @ApiProperty({ type: [DashboardWeeklyScheduleGridCellDto] })
  cells!: DashboardWeeklyScheduleGridCellDto[];
}
