import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class ParentAgendaItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  studentId!: number;

  @ApiProperty({ example: 'Layla Ahmad Khalil' })
  studentName!: string;

  @ApiProperty({ example: 'Complete exercises 1–10 on page 42.' })
  description!: string;

  @ApiProperty({ example: '2026-08-10' })
  date!: string;

  @ApiProperty({ example: '09:00' })
  time!: string;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 'https://cdn.example.com/agendas/homework.jpg' })
  imageLink!: string;

  @ApiProperty({ example: 'https://cdn.example.com/agendas/worksheet.pdf' })
  fileLink!: string;

  @ApiProperty({ example: '2026-08-08' })
  publishedDate!: string;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: 'A' })
  sectionName!: string;

  @ApiProperty({ example: '4' })
  class!: string;
}

export class ParentAgendasResponseDto {
  @ApiProperty({ example: '2026-08' })
  month!: string;

  @ApiProperty({ type: [ParentAgendaItemDto] })
  agendas!: ParentAgendaItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
