import { PartialType } from '@nestjs/swagger';
import { CreateDashboardClassCourseDto } from './create-dashboard-class-course.dto';

export class UpdateDashboardClassCourseDto extends PartialType(
  CreateDashboardClassCourseDto,
) {}
