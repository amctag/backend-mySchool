import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ParentGradeCardQueryDto {
  @ApiProperty({
    example: 23,
    description: 'Child registration id',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  registrationId!: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Optional guard — must match registration year',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId?: number;

  @ApiPropertyOptional({
    example: 12,
    description: 'Optional guard — must match registration class',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Optional guard — must match registration section',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId?: number;
}
