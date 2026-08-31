import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardWeeklyScheduleItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2026-2027' })
  yearTitle!: string;

  @ApiProperty({ example: 1 })
  classId!: number;

  @ApiProperty({ example: 'Grade 4' })
  className!: string;

  @ApiProperty({ example: 1 })
  sectionId!: number;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: 'Monday' })
  dayName!: string;

  @ApiProperty({ example: '1st Period' })
  sessionName!: string;

  @ApiProperty({ example: 1 })
  courseId!: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 1, nullable: true })
  personId!: number | null;

  @ApiProperty({ example: 'Sara Ali Nasser', nullable: true })
  createdByName!: string | null;
}

export class DashboardWeeklySchedulesResponseDto {
  @ApiProperty({ type: [DashboardWeeklyScheduleItemDto] })
  items!: DashboardWeeklyScheduleItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
