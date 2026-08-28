import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardCourseItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Mathematics' })
  title!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Core math curriculum' })
  description!: string | null;

  @ApiProperty({ example: true })
  status!: boolean;

  @ApiProperty({ example: 2 })
  classCourseCount!: number;
}
