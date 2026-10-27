import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class TeacherAttendanceOptionsDto {
  @ApiProperty({ example: true })
  attendancePerCourse!: boolean;

  @ApiProperty({ example: true })
  canTakeAttendance!: boolean;

  @ApiProperty({ example: 1 })
  defaultClassId!: number;

  @ApiProperty({ example: 1 })
  defaultSectionId!: number;

  @ApiProperty({ example: null })
  defaultCourseId!: number | null;

  @ApiProperty({ type: [Object] })
  classes!: any[];
}

export class TeacherAttendanceSheetDto {
  @ApiProperty({ example: 1 })
  attendanceId!: number;

  @ApiProperty({ example: '2025-01-15' })
  date!: string;

  @ApiProperty({ example: 1 })
  sectionId!: number;

  @ApiProperty({ example: 'Grade 4 - Section A' })
  classLabel!: string;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string | null;

  @ApiProperty({ type: [Object] })
  students!: any[];
}

export class TeacherAttendanceSheetQueryDto {
  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  date?: string;
}

export class DirectorAttendancesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  date?: string;
}

/** Query parameters for loading one section's attendance roster. */
export class DirectorAttendanceSheetQueryDto {
  @ApiPropertyOptional({ example: '2026-10-06' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({ example: 3, description: 'Section ID in the director school' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId!: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId?: number;
}

export class DirectorAttendanceOptionsDto {
  @ApiProperty({ example: true })
  attendancePerCourse!: boolean;

  @ApiProperty({ example: true })
  canTakeAttendance!: boolean;

  @ApiProperty({ example: 1 })
  defaultClassId!: number;

  @ApiProperty({ example: 1 })
  defaultSectionId!: number;

  @ApiProperty({ example: null })
  defaultCourseId!: number | null;

  @ApiProperty({ type: [Object] })
  classes!: any[];
}