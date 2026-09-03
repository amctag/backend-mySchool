import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardGradeTypeListItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  schoolId!: number | null;

  @ApiProperty({ example: 'Midterm' })
  title!: string;

  @ApiProperty({ example: false })
  isAbstract!: boolean;

  @ApiProperty({ example: 1 })
  position!: number;

  @ApiProperty({ example: false })
  isMain!: boolean;

  @ApiProperty({ example: 'exam' })
  type!: string;

  @ApiProperty({ example: true })
  status!: boolean;

  @ApiProperty({ example: '2026-09-01T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-01T10:00:00.000Z' })
  updatedAt!: string;
}

export class DashboardGradeTypesListResponseDto {
  @ApiProperty({ type: [DashboardGradeTypeListItemDto] })
  items!: DashboardGradeTypeListItemDto[];
}
