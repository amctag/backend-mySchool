import { PartialType } from '@nestjs/swagger';
import { CreateDashboardTeacherSupervisorDto } from './create-dashboard-teacher-supervisor.dto';

export class UpdateDashboardTeacherSupervisorDto extends PartialType(
  CreateDashboardTeacherSupervisorDto,
) {}
