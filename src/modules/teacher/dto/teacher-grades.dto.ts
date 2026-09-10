import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class TeacherGradesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 5, description: 'Section id' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId?: number;
}

export class TeacherGradeEntryQueryDto {
  @ApiProperty({ example: 5, description: 'Section id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId!: number;

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId!: number;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gradeTypeId!: number;
}

export class TeacherGradeTypeItemDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 'Quiz' })
  title!: string;
}

export class TeacherGradeCourseOptionDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 'Mathematics' })
  title!: string;

  @ApiProperty({ example: 21, description: 'Teach assignment id' })
  assignmentId!: number;

  @ApiProperty({ example: 2 })
  coefficient!: number;
}

export class TeacherGradeSectionOptionDto {
  @ApiProperty({ example: 5, description: 'Section id' })
  id!: number;

  @ApiProperty({ example: 'A' })
  title!: string;

  @ApiProperty({ type: [TeacherGradeCourseOptionDto] })
  courses!: TeacherGradeCourseOptionDto[];
}

export class TeacherGradeClassOptionDto {
  @ApiProperty({ example: 2, description: 'Class id (not section id)' })
  id!: number;

  @ApiProperty({ example: 'Grade 2' })
  name!: string;

  @ApiProperty({ type: [TeacherGradeSectionOptionDto] })
  sections!: TeacherGradeSectionOptionDto[];
}

export class TeacherGradeOptionsResponseDto {
  @ApiProperty({ type: [TeacherGradeClassOptionDto] })
  classes!: TeacherGradeClassOptionDto[];

  @ApiProperty({ type: [TeacherGradeTypeItemDto] })
  gradeTypes!: TeacherGradeTypeItemDto[];
}

export class TeacherGradeSheetItemDto {
  @ApiProperty({ example: 40 })
  id!: number;

  @ApiProperty({ example: 2 })
  classId!: number;

  @ApiProperty({ example: 'Grade 2' })
  className!: string;

  @ApiProperty({ example: 5 })
  sectionId!: number;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: 'Grade 2 - Section A' })
  classLabel!: string;

  @ApiProperty({ example: 12 })
  courseId!: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 3 })
  gradeTypeId!: number;

  @ApiProperty({ example: 'Quiz' })
  gradeTypeTitle!: string;

  @ApiProperty({ example: 20 })
  maxGrade!: number;

  @ApiProperty({ example: 2 })
  coefficient!: number;

  @ApiProperty({ example: '2026-09-08', nullable: true })
  publishDate!: string | null;

  @ApiProperty({ example: 24 })
  entriesCount!: number;
}

export class TeacherGradeSheetsResponseDto {
  @ApiProperty({ type: [TeacherGradeSheetItemDto] })
  items!: TeacherGradeSheetItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class TeacherGradeEntryStudentDto {
  @ApiProperty({ example: 88 })
  registrationId!: number;

  @ApiProperty({ example: 12 })
  studentId!: number;

  @ApiProperty({ example: 'Layla Ahmad Khalil' })
  fullName!: string;

  @ApiProperty({ example: 1 })
  seatNumber!: number;

  @ApiPropertyOptional({ example: 18, nullable: true })
  score!: number | null;

  @ApiPropertyOptional({ example: 'Strong work', nullable: true })
  comment!: string | null;
}

export class TeacherGradeEntryContextDto {
  @ApiPropertyOptional({ example: 40, nullable: true })
  gradeSheetId!: number | null;

  @ApiProperty({ example: 21 })
  assignmentId!: number;

  @ApiProperty({ example: 2 })
  classId!: number;

  @ApiProperty({ example: 'Grade 2' })
  className!: string;

  @ApiProperty({ example: 5 })
  sectionId!: number;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: 'Grade 2 - Section A' })
  classLabel!: string;

  @ApiProperty({ example: 12 })
  courseId!: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 3 })
  gradeTypeId!: number;

  @ApiProperty({ example: 'Quiz' })
  gradeTypeTitle!: string;

  @ApiProperty({ example: 2 })
  coefficient!: number;

  @ApiProperty({ example: 20 })
  maxGrade!: number;

  @ApiPropertyOptional({ example: '2026-09-08', nullable: true })
  publishDate!: string | null;

  @ApiProperty({ type: [TeacherGradeEntryStudentDto] })
  students!: TeacherGradeEntryStudentDto[];
}

export class TeacherStudentGradeEntryDto {
  @ApiProperty({ example: 88 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  registrationId!: number;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  score?: number;

  @ApiPropertyOptional({ example: 'Strong work' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class SaveTeacherGradeSheetDto {
  @ApiProperty({ example: 5, description: 'Section id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId!: number;

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId!: number;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gradeTypeId!: number;

  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(99999.99)
  maxGrade!: number;

  @ApiPropertyOptional({ example: '2026-09-08' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  publishDate?: string;

  @ApiProperty({ type: [TeacherStudentGradeEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeacherStudentGradeEntryDto)
  entries!: TeacherStudentGradeEntryDto[];
}
