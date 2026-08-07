import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ParentWeeklyScheduleQueryDto {
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
