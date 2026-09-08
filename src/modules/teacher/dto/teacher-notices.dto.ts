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

  @ApiProperty({ example: 12 })
  targetId!: number;

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

  @ApiProperty({
    example: 12,
    description: 'Student id when targetType=student, section id when section',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetId!: number;

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
