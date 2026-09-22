import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class DashboardOverviewQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Filter year-scoped stats by year id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId?: number;
}

export class DashboardOverviewStatsDto {
  @ApiProperty({ example: 120 })
  students!: number;

  @ApiProperty({ example: 18 })
  teachers!: number;

  @ApiProperty({ example: 12 })
  classes!: number;

  @ApiProperty({ example: 4 })
  absencesToday!: number;
}

export class DashboardOverviewStudentDto {
  @ApiProperty({ example: 1 })
  studentId!: number;

  @ApiProperty({ example: 'Sara Ahmad' })
  name!: string;

  @ApiProperty({ example: 'Grade 2', nullable: true })
  className!: string | null;

  @ApiProperty({ example: 'A', nullable: true })
  sectionName!: string | null;

  @ApiProperty({ example: 'Ahmad Parent', nullable: true })
  parentName!: string | null;
}

export class DashboardOverviewAgendaDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Fractions practice' })
  title!: string;

  @ApiProperty({ example: 'Complete exercises 1–10.' })
  description!: string;

  @ApiProperty({ example: '09:00' })
  time!: string;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 'Grade 2/A' })
  sectionsLabel!: string;
}

export class DashboardOverviewAnnouncementDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'School Holiday', nullable: true })
  title!: string | null;

  @ApiProperty({ example: 'School will be closed on Friday.' })
  content!: string;

  @ApiProperty({ example: 'Parents, Teachers' })
  audienceLabel!: string;
}

export class DashboardOverviewResponseDto {
  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: '2026-2027', nullable: true })
  yearTitle!: string | null;

  @ApiProperty({ example: 1, nullable: true })
  yearId!: number | null;

  @ApiProperty({ type: DashboardOverviewStatsDto })
  stats!: DashboardOverviewStatsDto;

  @ApiProperty({ type: [DashboardOverviewStudentDto] })
  recentStudents!: DashboardOverviewStudentDto[];

  @ApiProperty({ type: [DashboardOverviewAgendaDto] })
  todayAgendas!: DashboardOverviewAgendaDto[];

  @ApiProperty({ type: [DashboardOverviewAnnouncementDto] })
  recentAnnouncements!: DashboardOverviewAnnouncementDto[];
}
