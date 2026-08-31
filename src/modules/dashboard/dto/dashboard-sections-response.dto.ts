import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardSectionItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  classId!: number;

  @ApiProperty({ example: '4A' })
  className!: string;

  @ApiProperty({ example: 1 })
  sectionTitleId!: number;

  @ApiProperty({ example: 'Section A' })
  sectionTitle!: string;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiProperty({ example: true })
  isCurrentYear!: boolean;

  @ApiProperty({ example: 1 })
  status!: number;

  @ApiProperty({ example: 18 })
  studentCount!: number;
}

export class DashboardSectionsResponseDto {
  @ApiProperty({ type: [DashboardSectionItemDto] })
  items!: DashboardSectionItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class DashboardYearItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '2025-2026' })
  title!: string;

  @ApiProperty({ example: true })
  isCurrent!: boolean;
}

export class DashboardSectionTitleItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'A' })
  title!: string;

  @ApiProperty({ example: 1 })
  status!: number;

  @ApiProperty({
    example: 3,
    description: 'How many class sections reuse this title',
  })
  sectionCount!: number;
}
