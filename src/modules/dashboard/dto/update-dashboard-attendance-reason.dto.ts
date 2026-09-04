import { PartialType } from '@nestjs/swagger';
import { CreateDashboardAttendanceReasonDto } from './create-dashboard-attendance-reason.dto';

export class UpdateDashboardAttendanceReasonDto extends PartialType(
  CreateDashboardAttendanceReasonDto,
) {}
