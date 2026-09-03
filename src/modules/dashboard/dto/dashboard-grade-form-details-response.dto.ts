import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardGradeFormExpressionItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 12 })
  sourceGradeTypeId!: number;

  @ApiProperty({ example: 'Daily work 1' })
  sourceGradeTypeTitle!: string;

  @ApiProperty({ example: 12.5 })
  percentage!: number;
}

export class DashboardGradeFormDetailRowDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  gradeFormId!: number;

  @ApiProperty({ example: 1 })
  gradeTypeId!: number;

  @ApiProperty({ example: 'Midterm' })
  gradeTypeTitle!: string;

  @ApiProperty({ example: 1 })
  position!: number;

  @ApiPropertyOptional({ nullable: true, example: 40 })
  percentage!: number | null;

  @ApiProperty({ type: [DashboardGradeFormExpressionItemDto] })
  expressions!: DashboardGradeFormExpressionItemDto[];

  @ApiProperty({ example: true })
  status!: boolean;

  @ApiProperty({ example: true })
  isVisible!: boolean;

  @ApiProperty({ example: '2026-09-01T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-01T10:00:00.000Z' })
  updatedAt!: string;
}

export class DashboardGradeFormExpressionTypeOptionDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 'Daily work 1' })
  title!: string;
}

export class DashboardGradeFormExpressionTypesResponseDto {
  @ApiProperty({ type: [DashboardGradeFormExpressionTypeOptionDto] })
  items!: DashboardGradeFormExpressionTypeOptionDto[];
}

export class DashboardGradeFormExpressionsResponseDto {
  @ApiProperty({ type: [DashboardGradeFormExpressionItemDto] })
  items!: DashboardGradeFormExpressionItemDto[];
}

export class DashboardGradeFormDetailsListResponseDto {
  @ApiProperty({ example: 1 })
  gradeFormId!: number;

  @ApiProperty({ example: 'Primary Report Card' })
  title!: string;

  @ApiProperty({ type: [DashboardGradeFormDetailRowDto] })
  items!: DashboardGradeFormDetailRowDto[];
}
