import { ApiProperty } from '@nestjs/swagger';

export class DashboardAnnouncementItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'School Holiday', nullable: true })
  title!: string | null;

  @ApiProperty({ example: 'School will be closed on Friday for a public holiday.' })
  content!: string;

  @ApiProperty({ example: 'All school' })
  audience!: string;

  @ApiProperty({ example: '2026-08-20T08:00:00.000Z' })
  publishedAt!: string;

  @ApiProperty({ example: '2026-08-20T08:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: 1 })
  personId!: number;

  @ApiProperty({ example: 'Rania Fadi Admin' })
  createdByName!: string;
}

export class DashboardAnnouncementsResponseDto {
  @ApiProperty({ type: [DashboardAnnouncementItemDto] })
  items!: DashboardAnnouncementItemDto[];
}
