import { PartialType } from '@nestjs/swagger';
import { CreateDashboardNoticeTypeDto } from './create-dashboard-notice-type.dto';

export class UpdateDashboardNoticeTypeDto extends PartialType(
  CreateDashboardNoticeTypeDto,
) {}
