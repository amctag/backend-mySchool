import { PartialType } from '@nestjs/swagger';
import { CreateDashboardGradeFormDto } from './create-dashboard-grade-form.dto';

export class UpdateDashboardGradeFormDto extends PartialType(
  CreateDashboardGradeFormDto,
) {}
