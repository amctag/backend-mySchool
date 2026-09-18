import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class DashboardSchoolSettingsDto {
  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({
    example: true,
    description:
      'When true, teachers can see every course on a class timetable and roster. When false, they only see courses they teach.',
  })
  teachersSeeAllClassCourses!: boolean;
}

export class UpdateDashboardSchoolSettingsDto {
  @ApiProperty({
    example: false,
    description:
      'Allow teachers to see other courses in a class, not only the courses they teach.',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 1 || value === '1' || value === 'true') {
      return true;
    }
    if (value === false || value === 0 || value === '0' || value === 'false') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  teachersSeeAllClassCourses!: boolean;
}
