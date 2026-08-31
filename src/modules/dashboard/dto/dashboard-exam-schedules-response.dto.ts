import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardExamScheduleItemDto {
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

  @ApiProperty({ example: '2026-08-24', nullable: true })
  examDate!: string | null;

  @ApiProperty({ example: '2026-08-31T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: 'Rania Fadi Admin', nullable: true })
  createdByName!: string | null;
}

export class DashboardExamSchedulesResponseDto {
  @ApiProperty({ type: [DashboardExamScheduleItemDto] })
  items!: DashboardExamScheduleItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
