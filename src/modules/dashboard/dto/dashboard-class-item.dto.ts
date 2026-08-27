import { ApiProperty } from '@nestjs/swagger';

export class DashboardClassItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Grade 4' })
  className!: string;

  @ApiProperty({ example: 4 })
  classLevel!: number;

  @ApiProperty({ example: 1 })
  position!: number;

  @ApiProperty({ example: 1 })
  stageId!: number;

  @ApiProperty({ example: 'Primary' })
  stageTitle!: string;
}
