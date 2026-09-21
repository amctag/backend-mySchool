import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateDashboardTeacherSupervisorDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teacherId!: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Single class. Use classIds to assign multiple classes.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId?: number;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3],
    description: 'Assign the teacher as supervisor of multiple classes',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  classIds?: number[];

  @ApiPropertyOptional({
    example: 1,
    description: 'Defaults to the current school year',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId?: number;
}
