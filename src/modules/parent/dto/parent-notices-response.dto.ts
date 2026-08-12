import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class ParentNoticeItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  studentId!: number;

  @ApiProperty({ example: 'Layla Ahmad Khalil' })
  studentName!: string;

  @ApiProperty({ example: 'Please submit the medical form by Friday.' })
  description!: string;

  @ApiProperty({ example: '2026-08-10' })
  date!: string;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: 'A' })
  sectionName!: string;

  @ApiProperty({ example: '4' })
  class!: string;

  @ApiProperty({
    example: 'section',
    enum: ['student', 'section'],
    description:
      'How the child received the notice: directly targeted or via section membership',
  })
  receivedVia!: 'student' | 'section';
}

export class ParentNoticesResponseDto {
  @ApiProperty({ type: [ParentNoticeItemDto] })
  notices!: ParentNoticeItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
