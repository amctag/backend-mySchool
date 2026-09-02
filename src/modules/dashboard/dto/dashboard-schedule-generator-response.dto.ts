import { ApiProperty } from '@nestjs/swagger';

export class ScheduleGeneratorObjectDto {
  @ApiProperty({ example: '37' })
  id!: string;

  @ApiProperty({ example: '339' })
  Prof_id!: string;

  @ApiProperty({ example: '4' })
  section_id!: string;

  @ApiProperty({ example: '22' })
  matiere_id!: string;

  @ApiProperty({ example: '3' })
  year_id!: string;
}

export class DashboardScheduleGeneratorResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ type: [ScheduleGeneratorObjectDto] })
  objects!: ScheduleGeneratorObjectDto[];
}
