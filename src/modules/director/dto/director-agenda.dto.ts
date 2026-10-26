import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
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

  @ApiProperty({ example: '2025-01-15' })
  date!: string;

  @ApiProperty({ example: 'Mathematics Final' })
  title!: string;

  @ApiProperty({
    type: 'string',
    format: 'html',
    example: '<p>Study for exam</p>',
  })
  description!: string;

  @ApiProperty({ example: '2025-03-10' })
  startDate!: string;

  @ApiProperty({ example: '2025-03-12' })
  endDate!: string;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ type: [String], example: ['Grade 4', 'Grade 5'] })
  gradeLevels!: string[];

  @ApiProperty({ type: [String], example: ['4-A', '4-B'] })
  sectionTitles!: string[];

  @ApiProperty({ example: 'teacher-name' })
  createdBy!: string;

  @ApiProperty({ example: '2025-01-15T10:00:00.000Z' })
  createdAt!: string;
}

export class DirectorAgendasResponseDto {
  @ApiProperty({ type: [DirectorAgendaItemDto] })
  items!: DirectorAgendaItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
