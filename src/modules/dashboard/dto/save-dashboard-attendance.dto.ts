import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class SaveDashboardAttendanceDetailDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId!: number;

  @ApiProperty({ enum: ['present', 'absent', 'late', 'excused'], example: 'present' })
  @IsIn(['present', 'absent', 'late', 'excused'])
  status!: 'present' | 'absent' | 'late' | 'excused';

  @ApiPropertyOptional({ example: 1, nullable: true })
  @ValidateIf((dto: SaveDashboardAttendanceDetailDto) => dto.status === 'absent')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  attendanceReasonId?: number | null;

  @ApiPropertyOptional({ example: 'Fever since morning', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}

export class SaveDashboardAttendanceDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId!: number;

  @ApiProperty({ example: '2026-09-04' })
  @IsDateString()
  date!: string;

  @ApiProperty({ type: [SaveDashboardAttendanceDetailDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveDashboardAttendanceDetailDto)
  details!: SaveDashboardAttendanceDetailDto[];
}
