import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardAlbumImageDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'https://cdn.example.com/albums/1.jpg' })
  imageLink!: string;

  @ApiProperty({ example: 'Welcome', nullable: true })
  caption!: string | null;

  @ApiProperty({ example: 1 })
  position!: number;
}

export class DashboardAlbumItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Opening day' })
  title!: string;

  @ApiProperty({ example: 'Photos from the first day of school.' })
  description!: string;

  @ApiProperty({ example: '2026-09-05' })
  date!: string;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiProperty({ example: 4 })
  photoCount!: number;

  @ApiProperty({
    example: 'https://cdn.example.com/albums/1.jpg',
    nullable: true,
  })
  coverImage!: string | null;

  @ApiProperty({ type: [DashboardAlbumImageDto] })
  images!: DashboardAlbumImageDto[];

  @ApiProperty({ example: '2026-09-05T08:00:00.000Z' })
  createdAt!: string;
}

export class DashboardAlbumsResponseDto {
  @ApiProperty({ type: [DashboardAlbumItemDto] })
  items!: DashboardAlbumItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
