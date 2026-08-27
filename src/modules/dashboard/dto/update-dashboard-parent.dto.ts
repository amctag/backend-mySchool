import { PartialType } from '@nestjs/swagger';
import { CreateDashboardParentDto } from './create-dashboard-parent.dto';

export class UpdateDashboardParentDto extends PartialType(
  CreateDashboardParentDto,
) {}
