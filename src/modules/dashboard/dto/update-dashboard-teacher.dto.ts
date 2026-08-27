import { PartialType } from '@nestjs/swagger';
import { CreateDashboardTeacherDto } from './create-dashboard-teacher.dto';

export class UpdateDashboardTeacherDto extends PartialType(
  CreateDashboardTeacherDto,
) {}
