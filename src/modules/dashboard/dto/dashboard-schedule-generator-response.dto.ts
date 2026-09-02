import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScheduleGeneratorRefDto {
  @ApiProperty({ example: '4' })
  id!: string;

  @ApiProperty({ example: 'A' })
  name!: string;
}

export class ScheduleGeneratorSectionDto {
  @ApiProperty({ example: '4' })
  id!: string;

  @ApiProperty({ example: 'A' })
  name!: string;

  @ApiProperty({ example: '43' })
  class_id!: string;

  @ApiProperty({ example: 'Grade 1' })
  class_name!: string;
}

export class ScheduleGeneratorObjectDto {
  @ApiProperty({ example: '37' })
  id!: string;

  @ApiProperty({ type: ScheduleGeneratorRefDto })
  prof!: ScheduleGeneratorRefDto;

  @ApiProperty({ type: ScheduleGeneratorSectionDto })
  section!: ScheduleGeneratorSectionDto;

  @ApiProperty({ type: ScheduleGeneratorRefDto })
  matiere!: ScheduleGeneratorRefDto;

  @ApiProperty({ example: '3' })
  year_id!: string;

  @ApiPropertyOptional({ example: '4' })
  weekly_hours!: string | null;
}

export class DashboardScheduleGeneratorResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ type: [ScheduleGeneratorObjectDto] })
  objects!: ScheduleGeneratorObjectDto[];
}
