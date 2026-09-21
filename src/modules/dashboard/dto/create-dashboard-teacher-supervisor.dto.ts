import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class CreateDashboardTeacherSupervisorDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teacherId!: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Assign the teacher as supervisor across every section of this class. Required when sectionId is omitted.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Limit the assignment to one section. Omit to apply to all sections of the class.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId?: number;

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
