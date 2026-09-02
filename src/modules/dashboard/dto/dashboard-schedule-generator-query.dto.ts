import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class DashboardScheduleGeneratorQueryDto {
  @ApiProperty({ example: 1, description: 'School id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schoolId!: number;

  @ApiPropertyOptional({
    example: 4,
    description: 'Filter by section; omit to return all sections',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId?: number;
}
