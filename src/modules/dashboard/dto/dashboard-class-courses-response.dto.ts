import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardClassCourseItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  classId!: number;

  @ApiProperty({ example: 'Grade 4' })
  className!: string;

  @ApiProperty({ example: 1 })
  courseId!: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiProperty({ example: true })
  isCurrentYear!: boolean;

  @ApiProperty({ example: 1 })
  coefficient!: number;

  @ApiPropertyOptional({ nullable: true, example: 5 })
  numberOfHours!: number | null;

  @ApiProperty({ example: true })
  status!: boolean;
}

export class DashboardClassCoursesResponseDto {
  @ApiProperty({ type: [DashboardClassCourseItemDto] })
  items!: DashboardClassCourseItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
