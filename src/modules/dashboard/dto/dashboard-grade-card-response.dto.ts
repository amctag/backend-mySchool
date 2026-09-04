import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardGradeCardStudentDto {
  @ApiProperty({ example: 1 })
  registrationId!: number;

  @ApiProperty({ example: 1 })
  studentId!: number;

  @ApiProperty({ example: 'Layla Maya Hassan' })
  studentName!: string;

  @ApiProperty({ example: 1 })
  classId!: number;

  @ApiProperty({ example: 'Grade 2' })
  className!: string;

  @ApiProperty({ example: 1 })
  sectionId!: number;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2026-2027' })
  yearTitle!: string;
}

export class DashboardGradeCardFormDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Primary Report Card' })
  title!: string;

  @ApiProperty({ example: 'rtl' })
  direction!: string;

  @ApiProperty({ example: 'grade_on_top' })
  tableFormat!: string;

  @ApiProperty({
    example: 1,
    description: '1 = Numeric, 2 = Letter (A+, A, A-, …)',
  })
  gradeFormatId!: number;

  @ApiProperty({ example: 20, description: 'Average scale (e.g. 20 or 10)' })
  average!: number;

  @ApiProperty({
    example: 10,
    description: 'Pass minimum for نتيجة (ناجح / راسب)',
  })
  minimum!: number;
}

export class DashboardGradeCardCourseDto {
  @ApiProperty({ example: 1 })
  classCourseId!: number;

  @ApiProperty({ example: 1 })
  courseId!: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 2 })
  coefficient!: number;

  @ApiPropertyOptional({
    nullable: true,
    example: 280.59,
    description: 'Sum of visible grade-type scores for this course',
  })
  marksSum!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 14.76,
    description:
      'Scaled average: (marksSum / maxSum) * grade_form.average',
  })
  scaledAverage!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: true,
    description: 'true = ناجح, false = راسب, null = not enough data',
  })
  passed!: boolean | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 7.25,
    description: 'Unused legacy field',
  })
  yearlyAverage!: number | null;
}

export class DashboardGradeCardGradeTypeDto {
  @ApiProperty({ example: 1 })
  detailId!: number;

  @ApiProperty({ example: 3 })
  gradeTypeId!: number;

  @ApiProperty({ example: 'First term test' })
  gradeTypeTitle!: string;

  @ApiProperty({ example: 0 })
  position!: number;

  @ApiPropertyOptional({
    nullable: true,
    example: 40,
    description:
      'Sum of Expression percentages when this type is abstract; otherwise unused',
  })
  percentage!: number | null;
}

export class DashboardGradeCardCellDto {
  @ApiPropertyOptional({ nullable: true, example: 17.5 })
  score!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 20 })
  maxGrade!: number | null;

  @ApiPropertyOptional({ nullable: true })
  comment!: string | null;
}

export class DashboardGradeCardResponseDto {
  @ApiProperty({ type: DashboardGradeCardStudentDto })
  student!: DashboardGradeCardStudentDto;

  @ApiPropertyOptional({ type: DashboardGradeCardFormDto, nullable: true })
  gradeForm!: DashboardGradeCardFormDto | null;

  @ApiProperty({ type: [DashboardGradeCardCourseDto] })
  courses!: DashboardGradeCardCourseDto[];

  @ApiProperty({ type: [DashboardGradeCardGradeTypeDto] })
  gradeTypes!: DashboardGradeCardGradeTypeDto[];

  @ApiProperty({
    example: { '1-3': { score: 17.5, maxGrade: 20, comment: null } },
    description: 'Map key: `${courseId}-${gradeTypeId}`',
    type: 'object',
    additionalProperties: { type: 'object' },
  })
  cells!: Record<string, DashboardGradeCardCellDto>;
}
