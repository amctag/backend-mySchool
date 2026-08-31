import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardWeeklyScheduleItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  sectionId!: number;

  @ApiProperty({ example: 1 })
  classId!: number;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: 'Grade 4' })
  className!: string;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: '2026-2027' })
  yearTitle!: string;

  @ApiProperty({ example: '2026-08-31T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: 'Sara Ali Nasser', nullable: true })
  createdByName!: string | null;
}

export class DashboardWeeklySchedulesResponseDto {
  @ApiProperty({ type: [DashboardWeeklyScheduleItemDto] })
  items!: DashboardWeeklyScheduleItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
