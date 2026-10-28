import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class DirectorNoticesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  date?: string;
}

export class DirectorNoticeItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '2025-01-15' })
  date!: string;

  @ApiProperty({ example: 'Important announcement' })
  title!: string;

  @ApiProperty({ type: 'string', format: 'html', example: '<p>Content</p>' })
  content!: string;

  @ApiProperty({ example: 'created' })
  createdAt!: string;

  @ApiProperty({ example: 'director@school.com' })
  createdBy!: string;
}

export class DirectorNoticesResponseDto {
  @ApiProperty({ type: [DirectorNoticeItemDto] })
  items!: DirectorNoticeItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class DirectorUpsertNoticeDto {
  @IsInt() @Min(1) sectionId!: number;
  @IsIn(['class', 'student']) targetType!: 'class' | 'student';
  @IsArray() @IsInt({ each: true }) @IsOptional() studentIds?: number[];
  @IsString() title!: string;
  @IsString() description!: string;
  @IsString() publishDate!: string;
}
