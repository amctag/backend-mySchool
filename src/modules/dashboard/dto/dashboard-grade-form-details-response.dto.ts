import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiProperty({ example: true })
  status!: boolean;

  @ApiProperty({ example: true })
  isVisible!: boolean;

  @ApiProperty({ example: '2026-09-01T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-01T10:00:00.000Z' })
  updatedAt!: string;
}

export class DashboardGradeFormDetailsListResponseDto {
  @ApiProperty({ example: 1 })
  gradeFormId!: number;

  @ApiProperty({ example: 'Primary Report Card' })
  title!: string;

  @ApiProperty({ type: [DashboardGradeFormDetailRowDto] })
  items!: DashboardGradeFormDetailRowDto[];
}
