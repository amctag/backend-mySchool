import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class TeacherAttendancesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-09-18' })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class TeacherAttendanceOptionsQueryDto {
  @ApiPropertyOptional({ example: '2026-09-18' })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class TeacherAttendanceSheetQueryDto {
  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId!: number;

  @ApiProperty({ example: '2026-09-18' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: 11 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId?: number;
}

export class SaveTeacherAttendanceDetailDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId!: number;

  @ApiProperty({ enum: ['present', 'absent', 'late', 'excused'] })
  @IsIn(['present', 'absent', 'late', 'excused'])
  status!: 'present' | 'absent' | 'late' | 'excused';

  @ApiPropertyOptional({ example: 1, nullable: true })
  @ValidateIf((dto: SaveTeacherAttendanceDetailDto) => dto.status === 'absent')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  attendanceReasonId?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}

export class SaveTeacherAttendanceDto {
  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId!: number;

  @ApiPropertyOptional({ example: 11, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId?: number | null;

  @ApiProperty({ example: '2026-09-18' })
  @IsDateString()
  date!: string;

  @ApiProperty({ type: [SaveTeacherAttendanceDetailDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveTeacherAttendanceDetailDto)
  details!: SaveTeacherAttendanceDetailDto[];
}

export class TeacherAttendanceReasonDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Sick' })
  title!: string;
}

export class TeacherAttendanceCourseOptionDto {
  @ApiProperty({ example: 11 })
  id!: number;

  @ApiProperty({ example: 'Mathematics' })
  title!: string;
}

export class TeacherAttendanceSectionOptionDto {
  @ApiProperty({ example: 5 })
  id!: number;

  @ApiProperty({ example: 'A' })
  title!: string;

  @ApiProperty({ type: [TeacherAttendanceCourseOptionDto] })
  courses!: TeacherAttendanceCourseOptionDto[];
}

export class TeacherAttendanceClassOptionDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'Grade 2' })
  name!: string;

  @ApiProperty({ type: [TeacherAttendanceSectionOptionDto] })
  sections!: TeacherAttendanceSectionOptionDto[];
}

export class TeacherAttendanceOptionsDto {
  @ApiProperty({ example: false })
  attendancePerCourse!: boolean;

  @ApiProperty({
    example: true,
    description:
      'When true, the logged-in teacher or supervisor may save attendance for the returned classes.',
  })
  canTakeAttendance!: boolean;

  @ApiProperty({ type: [TeacherAttendanceClassOptionDto] })
  classes!: TeacherAttendanceClassOptionDto[];

  @ApiProperty({ type: [TeacherAttendanceReasonDto] })
  reasons!: TeacherAttendanceReasonDto[];
}

export class TeacherAttendanceStudentRowDto {
  @ApiProperty({ example: 12 })
  studentId!: number;

  @ApiProperty({ example: 1 })
  registrationId!: number;

  @ApiProperty({ example: 'Layla Ahmad' })
  studentName!: string;

  @ApiProperty({ enum: ['present', 'absent', 'late', 'excused'] })
  status!: 'present' | 'absent' | 'late' | 'excused';

  @ApiPropertyOptional({ nullable: true })
  attendanceReasonId!: number | null;

  @ApiPropertyOptional({ nullable: true })
  attendanceReasonTitle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;
}

export class TeacherAttendanceSheetDto {
  @ApiPropertyOptional({ nullable: true })
  attendanceId!: number | null;

  @ApiProperty({ example: '2026-09-18' })
  date!: string;

  @ApiProperty({ example: 5 })
  sectionId!: number;

  @ApiProperty({ example: 'Grade 2 - Section A' })
  classLabel!: string;

  @ApiPropertyOptional({ nullable: true })
  courseId!: number | null;

  @ApiPropertyOptional({ nullable: true })
  courseTitle!: string | null;

  @ApiProperty({ example: false })
  attendancePerCourse!: boolean;

  @ApiProperty({ type: [TeacherAttendanceStudentRowDto] })
  students!: TeacherAttendanceStudentRowDto[];
}

export class TeacherAttendanceListItemDto {
  @ApiProperty({ example: 9 })
  id!: number;

  @ApiProperty({ example: '2026-09-18' })
  date!: string;

  @ApiProperty({ example: 5 })
  sectionId!: number;

  @ApiProperty({ example: 'Grade 2 - Section A' })
  classLabel!: string;

  @ApiPropertyOptional({ nullable: true })
  courseId!: number | null;

  @ApiPropertyOptional({ nullable: true })
  courseTitle!: string | null;

  @ApiProperty({ example: 24 })
  studentCount!: number;

  @ApiProperty({ example: 2 })
  absentCount!: number;
}

export class TeacherAttendancesResponseDto {
  @ApiProperty({ type: [TeacherAttendanceListItemDto] })
  items!: TeacherAttendanceListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
