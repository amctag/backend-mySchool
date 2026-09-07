import { PartialType } from '@nestjs/swagger';
import { CreateDashboardAgendaDto } from './create-dashboard-agenda.dto';

export class UpdateDashboardAgendaDto extends PartialType(
  CreateDashboardAgendaDto,
) {}
