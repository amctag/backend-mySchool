import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class TeacherActivitiesQueryDto extends PaginationQueryDto {}

export class TeacherActivityItemDto {
  @ApiProperty({ example: 4 })
  id!: number;

  @ApiProperty({ example: 'Sports Day' })
  title!: string;

  @ApiProperty({ example: 'Annual sports day for all students.' })
  content!: string;

  @ApiProperty({ example: '2026-03-15' })
  date!: string;

  @ApiProperty({ example: 'https://cdn.example.com/activities/sports-day.jpg' })
  image!: string;

  @ApiProperty({ example: true })
  isGlobal!: boolean;

  @ApiProperty({ example: 'All school' })
  scopeLabel!: string;
}

export class TeacherActivitiesResponseDto {
  @ApiProperty({ type: [TeacherActivityItemDto] })
  items!: TeacherActivityItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class TeacherAlbumsQueryDto extends PaginationQueryDto {}

export class TeacherAlbumImageDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'https://cdn.example.com/albums/1.jpg' })
  imageLink!: string;

  @ApiPropertyOptional({ example: 'Opening ceremony', nullable: true })
  caption!: string | null;

  @ApiProperty({ example: 1 })
  position!: number;
}

export class TeacherAlbumItemDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'Sports Day 2026' })
  title!: string;

  @ApiProperty({ example: 'Photos from the annual sports day.' })
  description!: string;

  @ApiProperty({ example: '2026-03-15' })
  date!: string;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiProperty({ example: 8 })
  photoCount!: number;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/albums/1.jpg',
    nullable: true,
  })
  coverImage!: string | null;

  @ApiProperty({ type: [TeacherAlbumImageDto] })
  images!: TeacherAlbumImageDto[];
}

export class TeacherAlbumsResponseDto {
  @ApiProperty({ type: [TeacherAlbumItemDto] })
  items!: TeacherAlbumItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
