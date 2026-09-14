import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class TeacherAnnouncementsQueryDto extends PaginationQueryDto {}

export class TeacherAnnouncementItemDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 'Staff meeting', nullable: true })
  title!: string | null;

  @ApiProperty({ example: 'Please join the briefing at 2 PM.' })
  content!: string;

  @ApiProperty({ example: true })
  isGlobal!: boolean;

  @ApiProperty({ example: 'All school' })
  scopeLabel!: string;

  @ApiProperty({ example: '2026-09-14T08:00:00.000Z' })
  publishedAt!: string;
}

export class TeacherAnnouncementsResponseDto {
  @ApiProperty({ type: [TeacherAnnouncementItemDto] })
  items!: TeacherAnnouncementItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
