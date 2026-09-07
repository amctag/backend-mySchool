import { PartialType } from '@nestjs/swagger';
import { CreateDashboardAgendaSectionDto } from './create-dashboard-agenda-section.dto';

export class UpdateDashboardAgendaSectionDto extends PartialType(
  CreateDashboardAgendaSectionDto,
) {}
