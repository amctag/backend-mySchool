import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
export class DirectorGradesQueryDto extends PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) classId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) sectionId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) courseId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) gradeTypeId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) yearId?: number;
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  published?: boolean;
}
export class DirectorGradeEntryQueryDto {
  @Type(() => Number) @IsInt() @Min(1) sectionId!: number;
  @Type(() => Number) @IsInt() @Min(1) courseId!: number;
  @Type(() => Number) @IsInt() @Min(1) gradeTypeId!: number;
}
export class DirectorGradeEntryDto {
  @Type(() => Number) @IsInt() @Min(1) registrationId!: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  score?: number | null;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string | null;
}
export class SaveDirectorGradeSheetDto {
  @Type(() => Number) @IsInt() @Min(1) sectionId!: number;
  @Type(() => Number) @IsInt() @Min(1) courseId!: number;
  @Type(() => Number) @IsInt() @Min(1) gradeTypeId!: number;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(99999.99)
  maxGrade!: number;
  @IsOptional() @IsString() publishDate?: string | null;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectorGradeEntryDto)
  entries!: DirectorGradeEntryDto[];
}
export class DirectorGradeSheetDto {
  id!: number;
  classId!: number;
  className!: string;
  sectionId!: number;
  sectionTitle!: string;
  classLabel!: string;
  courseId!: number;
  courseTitle!: string;
  gradeTypeId!: number;
  gradeTypeTitle!: string;
  maxGrade!: number;
  coefficient!: number;
  publishDate!: string | null;
  published!: boolean;
  entriesCount!: number;
  scoredCount!: number;
}
export class DirectorGradeStudentDto {
  registrationId!: number;
  studentId!: number;
  fullName!: string;
  seatNumber!: number;
  score!: number | null;
  comment!: string | null;
}
export class DirectorGradeDetailDto extends DirectorGradeSheetDto {
  gradeSheetId!: number | null;
  isMain!: boolean;
  canPublish!: boolean;
  students!: DirectorGradeStudentDto[];
}
export class DirectorGradeSheetsResponseDto {
  items!: DirectorGradeSheetDto[];
  pagination!: PaginationMetaDto;
}
export class DirectorGradeOptionsResponseDto {
  classes!: any[];
  gradeTypes!: any[];
  years!: any[];
}
