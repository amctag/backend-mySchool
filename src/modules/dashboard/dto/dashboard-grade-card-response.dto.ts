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

  @ApiProperty({ example: true })
  average!: boolean;
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
    example: 7.25,
    description:
      'Mean of is_main type scores after abstract types are calculated from Expression percentages',
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
