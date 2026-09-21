import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class TeacherAnnouncementsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 2, description: 'Class id (not section id)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId?: number;

  @ApiPropertyOptional({ example: 201, description: 'Section id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId?: number;
}

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

export class CreateTeacherAnnouncementDto {
  @ApiPropertyOptional({ example: 'Class trip' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiProperty({ example: 'Please send permission slips tomorrow.' })
  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  content!: string;

  @ApiProperty({ enum: ['parent', 'teacher'], example: 'parent' })
  @IsIn(['parent', 'teacher'])
  audience!: 'parent' | 'teacher';

  @ApiProperty({ example: 5, description: 'Supervised section id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId!: number;
}
