import { ApiProperty } from '@nestjs/swagger';
import { DashboardWeeklyScheduleGridResponseDto } from './dashboard-weekly-schedules-grid-response.dto';

export class DashboardWeeklySchedulesGridsResponseDto {
  @ApiProperty({ type: [DashboardWeeklyScheduleGridResponseDto] })
  items!: DashboardWeeklyScheduleGridResponseDto[];
}
