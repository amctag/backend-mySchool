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

export class SaveDashboardGradeByCourseEntryDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  registrationId!: number;

  @ApiPropertyOptional({ example: 86.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  grade?: number;

  @ApiPropertyOptional({ example: 'Good work' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class SaveDashboardGradeByCourseDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gradeTypeId!: number;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(99999.99)
  maxGrade!: number;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  publishDate?: string;

  @ApiProperty({ type: [SaveDashboardGradeByCourseEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveDashboardGradeByCourseEntryDto)
  entries!: SaveDashboardGradeByCourseEntryDto[];
}
