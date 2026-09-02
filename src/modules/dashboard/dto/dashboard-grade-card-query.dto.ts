import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class DashboardGradeCardQueryDto {
  @ApiProperty({ example: 1, description: 'Student registration id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  registrationId!: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Optional guard — must match registration section year',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Optional guard — must match registration class',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Optional guard — must match registration section',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId?: number;
}
