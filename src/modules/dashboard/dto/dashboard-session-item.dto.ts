import { ApiProperty } from '@nestjs/swagger';

export class DashboardSessionItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '1st Period' })
  sessionName!: string;

  @ApiProperty({ example: 1 })
  position!: number;

  @ApiProperty({ example: true })
  status!: boolean;

  @ApiProperty({ example: 12 })
  usageCount!: number;
}
