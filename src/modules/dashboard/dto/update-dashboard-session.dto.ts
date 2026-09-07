import { PartialType } from '@nestjs/swagger';
import { CreateDashboardSessionDto } from './create-dashboard-session.dto';

export class UpdateDashboardSessionDto extends PartialType(
  CreateDashboardSessionDto,
) {}
