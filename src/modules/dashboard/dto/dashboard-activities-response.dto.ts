import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardActivityItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Sports Day' })
  title!: string;

  @ApiProperty({ example: 'Students will compete in track and football.' })
  content!: string;

  @ApiProperty({ example: '2026-04-20' })
  date!: string;

  @ApiProperty({ example: 'https://cdn.example.com/activities/sports-day.jpg' })
  image!: string;

  @ApiProperty({ example: 'All school' })
  scope!: string;

  @ApiProperty({ example: 1, nullable: true })
  yearId!: number | null;

  @ApiProperty({ example: '2025-2026', nullable: true })
  yearTitle!: string | null;

  @ApiProperty({ example: '2026-04-20T08:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: 1 })
  personId!: number;

  @ApiProperty({ example: 'Rania Fadi Admin' })
  createdByName!: string;
}

export class DashboardActivitiesResponseDto {
  @ApiProperty({ type: [DashboardActivityItemDto] })
  items!: DashboardActivityItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
