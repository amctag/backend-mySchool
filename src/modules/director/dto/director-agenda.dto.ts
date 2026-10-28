import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
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

  @ApiProperty({ example: 1 })
  assignmentId!: number;

  @ApiProperty({ example: 1 })
  classId!: number;

  @ApiProperty({ example: 'Grade 4' })
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

  @ApiProperty({ example: '' })
  createdBy!: string;

  @ApiProperty({ example: '2025-01-15' })
  createdAt!: string;
}

export class DirectorAgendasResponseDto {
  @ApiProperty({ type: [DirectorAgendaItemDto] })
  items!: DirectorAgendaItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class DirectorUpsertAgendaDto {
  @IsInt() @Min(1) assignmentId!: number;
  @IsInt() @Min(1) classId!: number;
  @IsString() title!: string;
  @IsString() description!: string;
  @IsString() date!: string;
  @IsOptional() @IsString() imageLink?: string;
  @IsOptional() @IsString() fileLink?: string;
  @IsOptional() @IsString() time?: string;
  @IsOptional() @IsBoolean() published?: boolean;
}
