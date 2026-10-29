import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class DirectorAgendasQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  date?: string;

  @ApiPropertyOptional({ example: '2025-01' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  month?: string;
}

export class DirectorAgendaItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1, description: 'Teach.id' })
  assignmentId!: number;

  @ApiProperty({ example: 1, description: 'Section id (Teach.sectionId)' })
  classId!: number;

  @ApiProperty({ example: 'Grade 4 - A' })
  classLabel!: string;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 'Mathematics Final' })
  title!: string;

  @ApiProperty({
    type: 'string',
    format: 'html',
    example: '<p>Study for exam</p>',
  })
  description!: string;

  @ApiProperty({ example: '2025-01-15' })
  date!: string;

  @ApiProperty({ example: '2025-01-15' })
  publishDate!: string;

  @ApiProperty({ example: '09:00' })
  time!: string;

  @ApiProperty({ example: 'https://cdn.example.com/agendas/image.jpg' })
  imageLink!: string;

  @ApiProperty({ example: 'https://cdn.example.com/agendas/file.pdf' })
  fileLink!: string;

  @ApiProperty({ example: 'Jane Doe' })
  createdBy!: string;

  @ApiProperty({ example: '2025-01-15' })
  createdAt!: string;

  @ApiProperty({ example: false })
  published!: boolean;

  @ApiProperty({ example: 0, description: '0 = draft, 1 = published' })
  status!: number;
}

export class DirectorAgendasResponseDto {
  @ApiProperty({ type: [DirectorAgendaItemDto] })
  items!: DirectorAgendaItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class DirectorUpsertAgendaDto {
  @ApiProperty({ example: 10, description: 'Teach.id' })
  @IsInt()
  @Min(1)
  assignmentId!: number;

  @ApiProperty({ example: 20, description: 'Section id; must match the assignment' })
  @IsInt()
  @Min(1)
  classId!: number;

  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 'Chapter 3 exercises' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ example: '2026-10-29', description: 'YYYY-MM-DD or ISO-8601; only the calendar day is used' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ description: 'Omit to keep, "" to remove, URL to replace' })
  @IsOptional()
  @IsString()
  imageLink?: string;

  @ApiPropertyOptional({ description: 'Omit to keep, "" to remove, URL to replace' })
  @IsOptional()
  @IsString()
  fileLink?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, { message: 'time must be HH:mm' })
  time?: string;

  @ApiPropertyOptional({ example: false, description: 'true publishes; false keeps the current state (new agendas become drafts)' })
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
