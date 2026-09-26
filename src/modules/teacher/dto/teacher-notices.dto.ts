import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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

export class TeacherNoticesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId?: number;
}

export class TeacherNoticeItemDto {
  @ApiProperty({ example: 9 })
  id!: number;

  @ApiProperty({ example: 12, nullable: true })
  assignmentId!: number | null;

  @ApiProperty({ example: 5 })
  classId!: number;

  @ApiProperty({ example: 'student', enum: ['student', 'section'] })
  targetType!: 'student' | 'section';

  @ApiProperty({
    example: 12,
    description:
      'Primary target id (first student, or section id). Prefer targetIds for multi-student notices.',
  })
  targetId!: number;

  @ApiProperty({
    example: [12, 15],
    description: 'All targeted student ids when targetType=student.',
    type: [Number],
  })
  targetIds!: number[];

  @ApiProperty({ example: 'Layla Ahmad Khalil' })
  targetLabel!: string;

  @ApiProperty({ example: 'Grade 4 - Section A' })
  classLabel!: string;

  @ApiProperty({ example: 'Missing notebook' })
  title!: string;

  @ApiProperty({ example: 'Please bring the mathematics notebook tomorrow.' })
  content!: string;

  @ApiProperty({ example: 'Sara Ali Nasser' })
  creator!: string;

  @ApiProperty({ example: '2026-09-08' })
  publishDate!: string;
}

export class TeacherNoticesResponseDto {
  @ApiProperty({ type: [TeacherNoticeItemDto] })
  items!: TeacherNoticeItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class UpsertTeacherNoticeDto {
  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId!: number;

  @ApiProperty({ example: 'student', enum: ['student', 'section'] })
  @IsIn(['student', 'section'])
  targetType!: 'student' | 'section';

  @ApiPropertyOptional({
    example: 12,
    description:
      'Section id when targetType=section. For student notices prefer studentIds (or pass one id here).',
  })
  @ValidateIf(
    (dto: UpsertTeacherNoticeDto) =>
      dto.targetType === 'section' ||
      dto.studentIds == null ||
      dto.studentIds.length === 0,
  )
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetId?: number;

  @ApiPropertyOptional({
    example: [12, 15],
    description: 'One or more student ids when targetType=student.',
    type: [Number],
  })
  @ValidateIf((dto: UpsertTeacherNoticeDto) => dto.targetType === 'student')
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  studentIds?: number[];

  @ApiProperty({ example: 'Missing notebook' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'Please bring the mathematics notebook tomorrow.' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;

  @ApiProperty({ example: '2026-09-08' })
  @IsDateString()
  publishDate!: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignmentId?: number;
}
