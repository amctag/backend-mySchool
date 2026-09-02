import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDashboardGradeFormDto {
  @ApiProperty({ example: 'Primary Report Card' })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId!: number;

  @ApiPropertyOptional({ example: '/images/report-bg.png' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  gradeBackground?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  average?: boolean;

  @ApiPropertyOptional({ example: 'ltr', enum: ['ltr', 'rtl'] })
  @IsOptional()
  @IsString()
  @IsIn(['ltr', 'rtl'])
  direction?: string;

  @ApiPropertyOptional({
    example: 'grade_on_top',
    enum: ['course_on_top', 'grade_on_top'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['course_on_top', 'grade_on_top'])
  @MaxLength(30)
  tableFormat?: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gradeFormatId!: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @ApiPropertyOptional({ example: [1, 2], type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  classIds?: number[];
}
