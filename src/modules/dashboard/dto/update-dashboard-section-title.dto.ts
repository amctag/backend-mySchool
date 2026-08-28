import { PartialType } from '@nestjs/swagger';
import { CreateDashboardSectionTitleDto } from './create-dashboard-section-title.dto';

export class UpdateDashboardSectionTitleDto extends PartialType(
  CreateDashboardSectionTitleDto,
) {}
