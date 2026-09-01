import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardGradeByCourseItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2026-2027' })
  yearTitle!: string;

  @ApiProperty({ example: 1 })
  courseId!: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 1 })
  sectionId!: number;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: 'Grade 4' })
  className!: string;

  @ApiProperty({ example: 1 })
  gradeTypeId!: number;

  @ApiProperty({ example: 'Midterm' })
  gradeTypeTitle!: string;

  @ApiProperty({ example: 100 })
  maxGrade!: number;

  @ApiPropertyOptional({ example: '2026-06-15T08:00:00.000Z' })
  publishDate!: string | null;

  @ApiProperty({ example: '2026-06-10T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: 24 })
  studentCount!: number;
}

export class DashboardGradesByCourseResponseDto {
  @ApiProperty({ type: [DashboardGradeByCourseItemDto] })
  items!: DashboardGradeByCourseItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class DashboardGradeByCourseStudentDto {
  @ApiProperty({ example: 1 })
  registrationId!: number;

  @ApiProperty({ example: 1 })
  studentId!: number;

  @ApiProperty({ example: 'Layla Fadi Student' })
  studentName!: string;

  @ApiPropertyOptional({ example: 86.5 })
  grade!: number | null;

  @ApiPropertyOptional({ example: 'Good work' })
  comment!: string | null;
}

export class DashboardGradeByCourseCandidatesResponseDto {
  @ApiPropertyOptional({ example: 1 })
  gradeSheetId!: number | null;

  @ApiProperty({ example: 100 })
  maxGrade!: number;

  @ApiPropertyOptional({ example: '2026-06-15' })
  publishDate!: string | null;

  @ApiProperty({ type: [DashboardGradeByCourseStudentDto] })
  students!: DashboardGradeByCourseStudentDto[];
}

export class DashboardGradeByCourseDetailResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2026-2027' })
  yearTitle!: string;

  @ApiProperty({ example: 1 })
  classId!: number;

  @ApiProperty({ example: 'Grade 4' })
  className!: string;

  @ApiProperty({ example: 1 })
  courseId!: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 1 })
  sectionId!: number;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: 1 })
  gradeTypeId!: number;

  @ApiProperty({ example: 'Midterm' })
  gradeTypeTitle!: string;

  @ApiProperty({ example: 100 })
  maxGrade!: number;

  @ApiPropertyOptional({ example: '2026-06-15T08:00:00.000Z' })
  publishDate!: string | null;

  @ApiProperty({ example: '2026-06-10T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: [DashboardGradeByCourseStudentDto] })
  students!: DashboardGradeByCourseStudentDto[];
}
