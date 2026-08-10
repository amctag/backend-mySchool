import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Min } from 'class-validator';

export class ParentAttendanceAbsencesQueryDto {
  @ApiProperty({
    example: '2026-08',
    description: 'Month filter in YYYY-MM format',
  })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be in YYYY-MM format',
  })
  month!: string;

  @ApiPropertyOptional({
    description: 'Filter by child student id. Omit to return absences for all children.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId?: number;
}
