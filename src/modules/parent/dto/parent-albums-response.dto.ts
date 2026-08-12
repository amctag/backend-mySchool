import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ParentAlbumImageDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'https://cdn.example.com/albums/sports-day-1.jpg' })
  imageLink!: string;

  @ApiPropertyOptional({ example: 'Opening ceremony', nullable: true })
  caption!: string | null;

  @ApiProperty({ example: 1 })
  position!: number;
}

export class ParentAlbumItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Sports Day 2026' })
  title!: string;

  @ApiProperty({ example: 'Photos from the annual sports day event.' })
  description!: string;

  @ApiProperty({ example: '2026-03-15' })
  date!: string;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiProperty({ type: [ParentAlbumImageDto] })
  images!: ParentAlbumImageDto[];
}

export class ParentSchoolAlbumsDto {
  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ type: [ParentAlbumItemDto] })
  albums!: ParentAlbumItemDto[];
}

export class ParentAlbumsResponseDto {
  @ApiProperty({ type: [ParentSchoolAlbumsDto] })
  schools!: ParentSchoolAlbumsDto[];
}

export class ParentAlbumDetailResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: 'Sports Day 2026' })
  title!: string;

  @ApiProperty({ example: 'Photos from the annual sports day event.' })
  description!: string;

  @ApiProperty({ example: '2026-03-15' })
  date!: string;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiProperty({ type: [ParentAlbumImageDto] })
  images!: ParentAlbumImageDto[];
}
