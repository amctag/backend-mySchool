import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class TeacherAgendasQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 5,
    description: 'Filter by section id (class_id in the teacher app)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId?: number;

  @ApiPropertyOptional({
    example: '2026-09-08',
    description: 'Filter by agenda day YYYY-MM-DD',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  agendaDate?: string;
}

export class TeacherAgendaItemDto {
  @ApiProperty({ example: 21 })
  id!: number;

  @ApiProperty({ example: 12 })
  assignmentId!: number;

  @ApiProperty({ example: 5 })
  classId!: number;

  @ApiProperty({ example: 'Grade 4 - Section A' })
  classLabel!: string;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 'Fractions practice' })
  title!: string;

  @ApiProperty({ example: 'Solve workbook page 17 and bring your ruler.' })
  description!: string;

  @ApiProperty({ example: '2026-09-08' })
  date!: string;

  @ApiProperty({ example: '2026-09-07T08:00:00.000Z' })
  publishDate!: string;

  @ApiProperty({ example: '08:00' })
  time!: string;

  @ApiProperty({
    example: 'https://cdn.example.com/agendas/worksheet.pdf',
    nullable: true,
  })
  attachmentUrl!: string | null;
}

export class TeacherAgendasResponseDto {
  @ApiProperty({ type: [TeacherAgendaItemDto] })
  items!: TeacherAgendaItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class UpsertTeacherAgendaDto {
  @ApiProperty({ example: 12, description: 'Teach assignment id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignmentId!: number;

  @ApiProperty({
    example: 5,
    description: 'Section id. Must match the assignment section.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId!: number;

  @ApiProperty({ example: 'Fractions practice' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'Solve workbook page 17 and bring your ruler.' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ example: '2026-09-08' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  time?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/agendas/worksheet.pdf',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  attachmentUrl?: string;
}
