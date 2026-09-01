import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardGradeFormItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Primary Report Card' })
  title!: string;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiProperty({ example: null, nullable: true })
  gradeBackground!: string | null;

  @ApiProperty({ example: true })
  average!: boolean;

  @ApiProperty({ example: 'ltr' })
  direction!: string;

  @ApiProperty({ example: 'standard' })
  tableFormat!: string;

  @ApiProperty({ example: 1 })
  gradeFormatId!: number;

  @ApiProperty({ example: true })
  status!: boolean;

  @ApiProperty({ example: ['Grade 4'] })
  classNames!: string[];

  @ApiProperty({ example: '2026-09-01T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-01T10:00:00.000Z' })
  updatedAt!: string;
}

export class DashboardGradeFormsResponseDto {
  @ApiProperty({ type: [DashboardGradeFormItemDto] })
  items!: DashboardGradeFormItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class DashboardGradeFormDetailDto extends DashboardGradeFormItemDto {
  @ApiProperty({ example: [1, 2] })
  classIds!: number[];
}
