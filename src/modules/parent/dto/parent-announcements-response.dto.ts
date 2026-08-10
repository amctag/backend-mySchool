import { ApiProperty } from '@nestjs/swagger';

export class ParentAnnouncementItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'School Holiday', nullable: true })
  title!: string | null;

  @ApiProperty({ example: 'School will be closed on Friday.' })
  content!: string;

  @ApiProperty({ example: '2026-08-10T08:00:00.000Z' })
  publishedAt!: string;

  @ApiProperty({ example: true })
  isGlobal!: boolean;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: 'A', nullable: true })
  sectionName!: string | null;

  @ApiProperty({ example: '4', nullable: true })
  class!: string | null;
}

export class ParentAnnouncementsResponseDto {
  @ApiProperty({ type: [ParentAnnouncementItemDto] })
  announcements!: ParentAnnouncementItemDto[];
}
