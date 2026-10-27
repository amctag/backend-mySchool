import { PartialType } from '@nestjs/swagger';
import { CreateDashboardDirectorDto } from './create-dashboard-director.dto';

export class UpdateDashboardDirectorDto extends PartialType(
  CreateDashboardDirectorDto,
) {}
