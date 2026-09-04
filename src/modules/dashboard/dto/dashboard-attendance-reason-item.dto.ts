import { ApiProperty } from '@nestjs/swagger';

export class DashboardAttendanceReasonItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Sick' })
  title!: string;

  @ApiProperty({ example: true })
  status!: boolean;

  @ApiProperty({ example: 3 })
  usageCount!: number;
}
