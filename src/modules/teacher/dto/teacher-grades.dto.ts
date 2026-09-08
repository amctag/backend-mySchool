import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class TeacherGradesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignmentId?: number;
}

export class TeacherGradeTypeItemDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 'Quiz' })
  title!: string;
}

export class TeacherGradeTypesResponseDto {
  @ApiProperty({ type: [TeacherGradeTypeItemDto] })
  items!: TeacherGradeTypeItemDto[];
}

export class TeacherGradeAssessmentItemDto {
  @ApiProperty({ example: 40 })
  id!: number;

  @ApiProperty({ example: 12 })
  assignmentId!: number;

  @ApiProperty({ example: 5 })
  classId!: number;

  @ApiProperty({ example: 'Grade 4 - Section A' })
  classLabel!: string;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 'Fractions Quiz 1' })
  title!: string;

  @ApiProperty({ example: 'Quiz' })
  gradeTypeTitle!: string;

  @ApiProperty({ example: 20 })
  maxGrade!: number;

  @ApiProperty({ example: '2026-09-08T00:00:00.000Z', nullable: true })
  publishDate!: string | null;

  @ApiProperty({ example: 24 })
  entriesCount!: number;
}

export class TeacherGradeAssessmentsResponseDto {
  @ApiProperty({ type: [TeacherGradeAssessmentItemDto] })
  items!: TeacherGradeAssessmentItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class TeacherGradeEntryStudentDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 'Layla Ahmad Khalil' })
  fullName!: string;

  @ApiProperty({ example: 1 })
  seatNumber!: number;
}

export class TeacherGradeEntryContextDto {
  @ApiProperty({ example: 12 })
  assignmentId!: number;

  @ApiProperty({ example: 5 })
  classId!: number;

  @ApiProperty({ example: 'Grade 4 - Section A' })
  classLabel!: string;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ type: [TeacherGradeEntryStudentDto] })
  students!: TeacherGradeEntryStudentDto[];
}

export class TeacherStudentGradeEntryDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId!: number;

  @ApiProperty({ example: 18 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  score!: number;

  @ApiPropertyOptional({ example: 'Strong work' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class TeacherGradeAssessmentDetailsDto {
  @ApiProperty({ example: 40 })
  assessmentId!: number;

  @ApiProperty({ example: 12 })
  assignmentId!: number;

  @ApiProperty({ example: 'Fractions Quiz 1' })
  title!: string;

  @ApiProperty({ example: 'Quiz' })
  gradeTypeTitle!: string;

  @ApiProperty({ example: 20 })
  maxGrade!: number;

  @ApiProperty({ example: '2026-09-08T00:00:00.000Z', nullable: true })
  publishDate!: string | null;

  @ApiProperty({ example: 'Keep simplifying fractions carefully.', nullable: true })
  comment!: string | null;

  @ApiProperty({ type: [TeacherStudentGradeEntryDto] })
  entries!: TeacherStudentGradeEntryDto[];
}

export class UpsertTeacherGradeAssessmentDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignmentId!: number;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId!: number;

  @ApiProperty({ example: 'Fractions Quiz 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Preferred. Looked up on the school if omitted.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gradeTypeId?: number;

  @ApiProperty({ example: 'Quiz' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  gradeTypeTitle!: string;

  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(99999.99)
  maxGrade!: number;

  @ApiProperty({ example: '2026-09-08' })
  @IsDateString()
  publishDate!: string;

  @ApiPropertyOptional({ example: 'Keep simplifying fractions carefully.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiProperty({ type: [TeacherStudentGradeEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TeacherStudentGradeEntryDto)
  entries!: TeacherStudentGradeEntryDto[];
}
