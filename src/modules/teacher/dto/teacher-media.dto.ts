import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const ACTIVITY_SCOPE_TYPES = [
  'section_course',
  'section',
  'class',
  'stage',
] as const;

export type ActivityScopeType = (typeof ACTIVITY_SCOPE_TYPES)[number];

export class TeacherActivitiesQueryDto extends PaginationQueryDto {}

export class UpsertTeacherActivityDto {
  @ApiPropertyOptional({
    enum: ACTIVITY_SCOPE_TYPES,
    default: 'section_course',
    description:
      'section_course: one section + course. section: one section. class: all taught sections of a school class. stage: all taught sections of a stage.',
  })
  @IsOptional()
  @IsIn(ACTIVITY_SCOPE_TYPES)
  scopeType?: ActivityScopeType;

  @ApiPropertyOptional({
    example: 12,
    description: 'Required for section_course. Teach assignment id.',
  })
  @ValidateIf(
    (dto: UpsertTeacherActivityDto) =>
      (dto.scopeType ?? 'section_course') === 'section_course',
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignmentId?: number;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Section id. Required for section_course and section. Must match the assignment when scope is section_course.',
  })
  @ValidateIf((dto: UpsertTeacherActivityDto) => {
    const scope = dto.scopeType ?? 'section_course';
    return scope === 'section_course' || scope === 'section';
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'School class id (classes.id). Required when scopeType is class.',
  })
  @ValidateIf(
    (dto: UpsertTeacherActivityDto) => dto.scopeType === 'class',
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schoolClassId?: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Stage id. Required when scopeType is stage (or pass stageTitle).',
  })
  @ValidateIf(
    (dto: UpsertTeacherActivityDto) =>
      dto.scopeType === 'stage' &&
      (dto.stageTitle == null || dto.stageTitle.trim() === ''),
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stageId?: number;

  @ApiPropertyOptional({
    example: 'Primary',
    description:
      'Stage title. Used when scopeType is stage and stageId is not provided.',
  })
  @ValidateIf(
    (dto: UpsertTeacherActivityDto) =>
      dto.scopeType === 'stage' && dto.stageId == null,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  stageTitle?: string;

  @ApiProperty({ example: 'Sports Day' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'Annual sports day for this class.' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;

  @ApiPropertyOptional({ example: '2026-03-15' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/activities/sports-day.jpg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  image?: string;
}

export class TeacherActivityItemDto {
  @ApiProperty({ example: 4 })
  id!: number;

  @ApiProperty({ example: 12 })
  assignmentId!: number;

  @ApiProperty({ example: 5 })
  classId!: number;

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

  @ApiProperty({ example: 'Grade 2 - Section A · Mathematics' })
  scopeLabel!: string;

  @ApiProperty({ example: 'Grade 2 - Section A', nullable: true })
  classLabel!: string | null;

  @ApiProperty({ example: 'Mathematics', nullable: true })
  courseTitle!: string | null;

  @ApiProperty({
    example: true,
    description: 'True when the logged-in teacher created this activity.',
  })
  isOwn!: boolean;
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
