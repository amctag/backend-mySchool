import { ApiProperty } from '@nestjs/swagger';

export class DashboardGradeTypeListItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Midterm' })
  title!: string;

  @ApiProperty({ example: 'exam' })
  type!: string;

  @ApiProperty({ example: true })
  status!: boolean;
}

export class DashboardGradeTypesListResponseDto {
  @ApiProperty({ type: [DashboardGradeTypeListItemDto] })
  items!: DashboardGradeTypeListItemDto[];
}
