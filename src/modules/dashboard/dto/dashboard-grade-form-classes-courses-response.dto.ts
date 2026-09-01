import { ApiProperty } from '@nestjs/swagger';

export class DashboardGradeFormClassOptionDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Grade 4' })
  className!: string;
}

export class DashboardGradeFormCourseItemDto {
  @ApiProperty({ example: 1 })
  courseId!: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: ['Grade 4', 'Grade 5'] })
  classNames!: string[];
}

export class DashboardGradeFormClassesCoursesResponseDto {
  @ApiProperty({ example: 1 })
  gradeFormId!: number;

  @ApiProperty({ example: 'Primary Report Card' })
  title!: string;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiProperty({ example: [1, 2] })
  classIds!: number[];

  @ApiProperty({ type: [DashboardGradeFormClassOptionDto] })
  classes!: DashboardGradeFormClassOptionDto[];

  @ApiProperty({ type: [DashboardGradeFormCourseItemDto] })
  courses!: DashboardGradeFormCourseItemDto[];
}
