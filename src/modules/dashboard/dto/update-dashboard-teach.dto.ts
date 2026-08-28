import { PartialType } from '@nestjs/swagger';
import { CreateDashboardTeachDto } from './create-dashboard-teach.dto';

export class UpdateDashboardTeachDto extends PartialType(
  CreateDashboardTeachDto,
) {}
