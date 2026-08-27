import { PartialType } from '@nestjs/swagger';
import { CreateDashboardSectionDto } from './create-dashboard-section.dto';

export class UpdateDashboardSectionDto extends PartialType(
  CreateDashboardSectionDto,
) {}
