import { PartialType, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateDashboardClassCourseDto } from './create-dashboard-class-course.dto';
import { IsInt, IsOptional, Min, Max } from 'class-validator';

function toBoolean({ value }: { value: unknown }): unknown {
  if (value === true || value === 1 || value === '1' || value === 'true') {
    return true;
  }
  if (value === false || value === 0 || value === '0' || value === 'false') {
    return false;
  }
  return value;
}

export class UpdateDashboardClassCourseDto extends PartialType(
  CreateDashboardClassCourseDto,
) {
  @ApiProperty({ example: 0, description: 'Position for course ordering in grade card; 0 = use alphabetical' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32767)
  position?: number;
}
