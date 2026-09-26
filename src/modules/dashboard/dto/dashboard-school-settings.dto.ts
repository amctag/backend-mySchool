import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

function toOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 1 || value === '1' || value === 'true') {
    return true;
  }
  if (value === false || value === 0 || value === '0' || value === 'false') {
    return false;
  }
  return value;
}

export const ATTENDANCE_MODES = ['school', 'teacher', 'teacher_course'] as const;
export type AttendanceModeSetting = (typeof ATTENDANCE_MODES)[number];

export class DashboardSchoolSettingsDto {
  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({
    example: true,
    description:
      'When true, teachers can see every course on a class timetable and roster. When false, they only see courses they teach.',
  })
  teachersSeeAllClassCourses!: boolean;

  @ApiProperty({
    example: 'school',
    enum: ATTENDANCE_MODES,
    description:
      'school = dashboard only; teacher = first-session teacher; teacher_course = each course teacher.',
  })
  attendanceMode!: AttendanceModeSetting;

  @ApiProperty({
    example: true,
    description:
      'When true, teachers can publish agendas to parents. When false, teachers only save drafts and the school publishes them from the dashboard.',
  })
  teachersCanPublishAgenda!: boolean;

  @ApiProperty({
    example: true,
    description:
      'When true, teachers can publish grades to parents. When false, teachers only save drafts and supervisors (or the school) publish them.',
  })
  teachersCanPublishGrades!: boolean;
}

export class UpdateDashboardSchoolSettingsDto {
  @ApiPropertyOptional({
    example: false,
    description:
      'Allow teachers to see other courses in a class, not only the courses they teach.',
  })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  teachersSeeAllClassCourses?: boolean;

  @ApiPropertyOptional({
    example: 'teacher',
    enum: ATTENDANCE_MODES,
    description:
      'school = dashboard only; teacher = first-session teacher; teacher_course = each course teacher.',
  })
  @IsOptional()
  @IsString()
  @IsIn(ATTENDANCE_MODES)
  attendanceMode?: AttendanceModeSetting;

  @ApiPropertyOptional({
    example: false,
    description:
      'Allow teachers to publish agendas. Off = school publishes from the dashboard.',
  })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  teachersCanPublishAgenda?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Allow teachers to publish grades. Off = teachers save drafts; supervisors can publish.',
  })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  teachersCanPublishGrades?: boolean;
}
