import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateDashboardTeachDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teacherId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId!: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Single course. Use courseIds to assign multiple courses.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId?: number;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3],
    description: 'Assign the teacher to multiple courses in this section',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  courseIds?: number[];

  @ApiPropertyOptional({
    example: 1,
    description: 'Defaults to the section year, or the current school year',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId?: number;
}
