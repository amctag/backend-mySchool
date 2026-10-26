import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class TeacherAlbumsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  date?: string;
}

export class TeacherAlbumItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '2025-01-15' })
  date!: string;

  @ApiProperty({ example: 'Grade 4 Album' })
  title!: string;

  @ApiProperty({ type: [String], example: ['image1.jpg', 'image2.jpg'] })
  images!: string[];

  @ApiProperty({ example: '2025-03-10' })
  yearTitle!: string;
}

export class TeacherAlbumsResponseDto {
  @ApiProperty({ type: [TeacherAlbumItemDto] })
  items!: TeacherAlbumItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}