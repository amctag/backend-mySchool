import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class DirectorAnnouncementsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  date?: string;
}

export class DirectorAnnouncementItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Important school update', description: 'Announcement title' })
  title!: string;

  @ApiProperty({ example: '2025-01-15' })
  publishDate!: string;

  @ApiProperty({ example: '10:00:00' })
  publishTime!: string;

  @ApiProperty({ example: 'all' })
  targetAudience!: string;

  @ApiProperty({ type: [String], example: ['grade-4', 'grade-5'] })
  targetGrades!: string[];

  @ApiProperty({ example: 'Important school update' })
  subject!: string;

  @ApiProperty({ type: 'string', format: 'html', example: '<p>Hello</p>' })
  content!: string;

  @ApiProperty({ example: 'created' })
  createdAt!: string;

  @ApiProperty({ example: 'director@school.com' })
  createdBy!: string;
}

export class DirectorAnnouncementsResponseDto {
  @ApiProperty({ type: [DirectorAnnouncementItemDto] })
  items!: DirectorAnnouncementItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}