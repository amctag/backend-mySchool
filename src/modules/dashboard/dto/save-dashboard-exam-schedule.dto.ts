import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class SaveDashboardExamScheduleExamDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @ApiProperty({ example: 90 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration!: number;

  @ApiPropertyOptional({ example: 'Room 204' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class SaveDashboardExamScheduleDateDto {
  @ApiProperty({ example: '2026-06-10' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiProperty({ type: [SaveDashboardExamScheduleExamDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveDashboardExamScheduleExamDto)
  exams!: SaveDashboardExamScheduleExamDto[];
}

export class SaveDashboardExamScheduleDto {
  @ApiProperty({ example: 'Midterm Exams 2026' })
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId?: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gradeTypeId!: number;

  @ApiPropertyOptional({ example: 'Please arrive early.' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiProperty({ type: [SaveDashboardExamScheduleDateDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveDashboardExamScheduleDateDto)
  dates!: SaveDashboardExamScheduleDateDto[];
}
