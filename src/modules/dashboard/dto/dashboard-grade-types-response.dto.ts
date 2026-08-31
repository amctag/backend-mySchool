import { ApiProperty } from '@nestjs/swagger';

export class DashboardGradeTypeItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Midterm' })
  title!: string;
}

export class DashboardGradeTypesResponseDto {
  @ApiProperty({ type: [DashboardGradeTypeItemDto] })
  items!: DashboardGradeTypeItemDto[];
}
