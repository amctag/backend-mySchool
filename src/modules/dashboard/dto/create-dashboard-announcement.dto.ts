import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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

const ANNOUNCEMENT_AUDIENCES = ['parent', 'student', 'teacher'] as const;
export type AnnouncementAudienceValue = (typeof ANNOUNCEMENT_AUDIENCES)[number];

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
    enum: ANNOUNCEMENT_AUDIENCES,
    isArray: true,
    example: ['parent', 'teacher'],
    description: 'One or more audiences for the same announcement',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(ANNOUNCEMENT_AUDIENCES, { each: true })
  audienceTargets!: AnnouncementAudienceValue[];

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
