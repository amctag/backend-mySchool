import { PartialType } from '@nestjs/swagger';
import { CreateDashboardStudentDto } from './create-dashboard-student.dto';

export class UpdateDashboardStudentDto extends PartialType(
  CreateDashboardStudentDto,
) {}
