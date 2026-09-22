import { PartialType } from '@nestjs/swagger';
import { CreateDashboardRegistrationDto } from './create-dashboard-registration.dto';

export class UpdateDashboardRegistrationDto extends PartialType(
  CreateDashboardRegistrationDto,
) {}
