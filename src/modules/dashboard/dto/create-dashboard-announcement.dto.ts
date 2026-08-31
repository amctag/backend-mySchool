import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateDashboardAnnouncementDto {
  @ApiPropertyOptional({ example: 'School Holiday' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiProperty({ example: 'School will be closed on Friday for a public holiday.' })
  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  content!: string;

  @ApiProperty({
    enum: ['parent', 'student', 'teacher'],
    example: 'parent',
  })
  @IsString()
  @IsIn(['parent', 'student', 'teacher'])
  audienceTarget!: 'parent' | 'student' | 'teacher';

  @ApiPropertyOptional({
    example: 1,
    description: 'Creator person id (defaults to 1 for now)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  personId?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Limit to one section; omit for all school',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId?: number;
}
