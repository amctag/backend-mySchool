import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ParentGradesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by child student id. Omit to return grades for all children.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId?: number;

  @ApiPropertyOptional({
    description: 'Filter by child registration id from GET /parent/me/children.',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  registrationId?: number;
}
