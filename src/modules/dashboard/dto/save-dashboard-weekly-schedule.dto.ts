import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaveDashboardWeeklyScheduleEntryDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dayId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sessionId!: number;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId!: number;
}

export class SaveDashboardWeeklyScheduleDto {
  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId?: number;

  @ApiProperty({ type: [SaveDashboardWeeklyScheduleEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveDashboardWeeklyScheduleEntryDto)
  entries!: SaveDashboardWeeklyScheduleEntryDto[];
}
