import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardNoticeTypeItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Behavior' })
  title!: string;
}

export class DashboardNoticeItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Please submit the medical form by Friday.' })
  description!: string;

  @ApiProperty({ example: '2026-09-07' })
  date!: string;

  @ApiProperty({ example: 'All school' })
  scope!: string;

  @ApiProperty({ example: 1, nullable: true })
  noticeTypeId!: number | null;

  @ApiProperty({ example: 'Behavior', nullable: true })
  noticeTypeTitle!: string | null;

  @ApiProperty({ example: [5], type: [Number] })
  sectionIds!: number[];

  @ApiProperty({ example: [12, 15], type: [Number] })
  studentIds!: number[];

  @ApiProperty({ example: 2 })
  studentCount!: number;

  @ApiProperty({ example: true })
  status!: boolean;

  @ApiProperty({ example: '2026-09-07T08:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: 1 })
  personId!: number;

  @ApiProperty({ example: 'Rania Fadi Admin' })
  createdByName!: string;
}

export class DashboardNoticesResponseDto {
  @ApiProperty({ type: [DashboardNoticeItemDto] })
  items!: DashboardNoticeItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
