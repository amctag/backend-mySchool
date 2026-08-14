import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ParentExamSchedulesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by child student id. Omit to return schedules for all children.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId?: number;
}

export class ParentExamScheduleDetailQueryDto {
  @ApiPropertyOptional({
    description: 'Optional child student id used to verify access to the exam schedule.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId?: number;
}
