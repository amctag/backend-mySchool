import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ParentGradeItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 'Midterm' })
  gradeTypeTitle!: string;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiProperty({ example: 100 })
  maxGrade!: number;

  @ApiPropertyOptional({ example: 86.5, nullable: true })
  score!: number | null;

  @ApiPropertyOptional({ example: 'Good work', nullable: true })
  comment!: string | null;

  @ApiProperty({ example: '2026-06-15T08:00:00.000Z' })
  publishDate!: string;
}

export class ParentStudentGradesDto {
  @ApiProperty({ example: 1 })
  studentId!: number;

  @ApiProperty({ example: 12 })
  registrationId!: number;

  @ApiProperty({ example: 'Layla Ahmad Khalil' })
  studentName!: string;

  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: '4A' })
  className!: string;

  @ApiProperty({ example: 'A' })
  sectionName!: string;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiProperty({ type: [ParentGradeItemDto] })
  grades!: ParentGradeItemDto[];
}

export class ParentGradesResponseDto {
  @ApiProperty({ type: [ParentStudentGradesDto] })
  students!: ParentStudentGradesDto[];
}
