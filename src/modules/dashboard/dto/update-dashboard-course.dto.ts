import { PartialType } from '@nestjs/swagger';
import { CreateDashboardCourseDto } from './create-dashboard-course.dto';

export class UpdateDashboardCourseDto extends PartialType(
  CreateDashboardCourseDto,
) {}
