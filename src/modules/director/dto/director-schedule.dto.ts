import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export enum DirectorScheduleMode {
  Class = 'class',
  Teacher = 'teacher',
}

export class DirectorScheduleOptionsQueryDto {
  @ApiPropertyOptional({
    example: 3,
    description: 'School year id. Defaults to the active (current) year.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId?: number;
}

export class DirectorWeeklyScheduleQueryDto extends DirectorScheduleOptionsQueryDto {
  @ApiPropertyOptional({
    enum: DirectorScheduleMode,
    default: DirectorScheduleMode.Class,
    description:
      'Schedule view. "class" returns the timetable of one section, "teacher" returns the timetable of one teacher.',
  })
  @IsOptional()
  @IsEnum(DirectorScheduleMode)
  mode?: DirectorScheduleMode;

  @ApiPropertyOptional({
    example: 12,
    description: 'Section id (sections.id). Required when mode is "class".',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId?: number;

  @ApiPropertyOptional({
    example: 4,
    description: 'Teacher id (teachers.id). Required when mode is "teacher".',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teacherId?: number;
}

export class DirectorScheduleYearDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: '2026-2027' })
  title!: string;
}

export class DirectorScheduleSectionOptionDto {
  @ApiProperty({ example: 12, description: 'Section id (sections.id)' })
  sectionId!: number;

  @ApiProperty({ example: 3, description: 'School class id (classes.id)' })
  classId!: number;

  @ApiProperty({ example: 'Grade 2' })
  className!: string;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: 'Grade 2 - A' })
  classLabel!: string;

  @ApiProperty({ example: 24 })
  studentCount!: number;
}

export class DirectorScheduleClassOptionDto {
  @ApiProperty({ example: 3 })
  classId!: number;

  @ApiProperty({ example: 'Grade 2' })
  className!: string;

  @ApiProperty({ type: [DirectorScheduleSectionOptionDto] })
  sections!: DirectorScheduleSectionOptionDto[];
}

export class DirectorScheduleTeacherOptionDto {
  @ApiProperty({ example: 4, description: 'Teacher id (teachers.id)' })
  teacherId!: number;

  @ApiProperty({ example: 1320, description: 'Person id of the teacher' })
  personId!: number;

  @ApiProperty({ example: 'Nabil Haddad' })
  fullName!: string;

  @ApiProperty({ example: 'nabil.haddad' })
  username!: string;
}

export class DirectorScheduleOptionsResponseDto {
  @ApiProperty({
    type: () => DirectorScheduleYearDto,
    nullable: true,
    description: 'Active academic year, or null when the school has no year.',
  })
  year!: DirectorScheduleYearDto | null;

  @ApiProperty({ type: [DirectorScheduleClassOptionDto] })
  classes!: DirectorScheduleClassOptionDto[];

  @ApiProperty({ type: [DirectorScheduleTeacherOptionDto] })
  teachers!: DirectorScheduleTeacherOptionDto[];
}

export class DirectorScheduleEntryDto {
  @ApiProperty({ example: 62, description: 'weekly_schedule_details.id' })
  detailId!: number;

  @ApiProperty({ example: 1, description: 'days.id' })
  dayId!: number;

  @ApiProperty({ example: 'Monday' })
  dayName!: string;

  @ApiProperty({ example: 1, description: 'Day order inside the school week' })
  dayPosition!: number;

  @ApiProperty({ example: 1, description: 'sessions.id' })
  sessionId!: number;

  @ApiProperty({ example: 2, description: 'sessions.position' })
  periodNumber!: number;

  @ApiProperty({ example: 'Session 2' })
  periodLabel!: string;

  @ApiProperty({ example: 1, description: 'courses.id' })
  courseId!: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 3, description: 'classes.id', nullable: true })
  classId!: number | null;

  @ApiProperty({ example: 'Grade 2', nullable: true })
  className!: string | null;

  @ApiProperty({ example: 12, description: 'sections.id' })
  sectionId!: number;

  @ApiProperty({ example: 'A', nullable: true })
  sectionTitle!: string | null;

  @ApiProperty({ example: 'Grade 2 - A', nullable: true })
  classLabel!: string | null;

  @ApiProperty({ example: 1, description: 'teachers.id', nullable: true })
  teacherId!: number | null;

  @ApiProperty({ example: 1320, description: 'persons.id', nullable: true })
  teacherPersonId!: number | null;

  @ApiProperty({ example: 'Nabil Haddad' })
  teacherName!: string;

  @ApiProperty({ example: '', description: 'Optional free-text note / room' })
  note!: string;
}

export class DirectorScheduleDayDto {
  @ApiProperty({ example: 1, description: 'days.id' })
  dayId!: number;

  @ApiProperty({ example: 'Monday' })
  dayName!: string;

  @ApiProperty({ example: 1 })
  position!: number;

  @ApiProperty({ type: [DirectorScheduleEntryDto] })
  entries!: DirectorScheduleEntryDto[];
}

export class DirectorScheduleSessionDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Session 1' })
  name!: string;

  @ApiProperty({ example: 1 })
  position!: number;
}

export class DirectorWeeklyScheduleResponseDto {
  @ApiProperty({ enum: DirectorScheduleMode })
  mode!: DirectorScheduleMode;

  @ApiProperty({ type: () => DirectorScheduleYearDto, nullable: true })
  year!: DirectorScheduleYearDto | null;

  @ApiProperty({ example: 'Grade 2 - A' })
  ownerLabel!: string;

  @ApiProperty({ example: 3, nullable: true })
  classId!: number | null;

  @ApiProperty({ example: 'Grade 2', nullable: true })
  className!: string | null;

  @ApiProperty({ example: 12, nullable: true })
  sectionId!: number | null;

  @ApiProperty({ example: 'A', nullable: true })
  sectionTitle!: string | null;

  @ApiProperty({ example: 7, nullable: true })
  teacherId!: number | null;

  @ApiProperty({ example: 'Nabil Haddad', nullable: true })
  teacherName!: string | null;

  @ApiProperty({ example: 13 })
  entryCount!: number;

  @ApiProperty({ type: [DirectorScheduleSessionDto] })
  sessions!: DirectorScheduleSessionDto[];

  @ApiProperty({
    type: [DirectorScheduleDayDto],
    description:
      'Every weekday of the school in day position order. Days without lessons have an empty entries array.',
  })
  days!: DirectorScheduleDayDto[];
}

export class DirectorTeachingAssignmentItemDto {
  @ApiProperty({ example: 1, description: 'Teach assignment id' })
  id!: number;

  @ApiProperty({ example: 12, description: 'Section id (sections.id)' })
  class_id!: number;

  @ApiProperty({ example: 3, description: 'School class id (classes.id)' })
  school_class_id!: number;

  @ApiProperty({ example: 'Grade 2' })
  class_name!: string;

  @ApiProperty({ example: 'A' })
  section_title!: string;

  @ApiProperty({ example: '2026-2027' })
  year_title!: string;

  @ApiProperty({ example: 1 })
  stage_id!: number;

  @ApiProperty({ example: 'Primary' })
  stage!: string;

  @ApiProperty({ example: 'Mathematics' })
  course_title!: string;

  @ApiProperty({ example: 'Monday' })
  day_name!: string;

  @ApiProperty({ example: 1 })
  period_number!: number;

  @ApiProperty({ example: 'Session 1' })
  period_label!: string;

  @ApiProperty({ example: '' })
  start_time!: string;

  @ApiProperty({ example: '' })
  end_time!: string;

  @ApiProperty({ example: '' })
  room!: string;
}

export class DirectorTeachingAssignmentsResponseDto {
  @ApiProperty({ type: [DirectorTeachingAssignmentItemDto] })
  items!: DirectorTeachingAssignmentItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class DirectorScheduleAssignmentsQueryDto extends PaginationQueryDto {}
