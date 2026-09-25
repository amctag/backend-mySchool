import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateDashboardTeacherTaskDto {
  @ApiProperty({ example: 'Submit midterm grades' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    example: 'Please enter all midterm grades before Friday.',
  })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  description!: string;
}

export class DashboardTeacherTasksQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 'grades' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  search?: string;
}

export class DashboardTeacherTaskItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Submit midterm grades' })
  title!: string;

  @ApiProperty({ example: 'Please enter all midterm grades before Friday.' })
  description!: string;

  @ApiProperty({ example: '2026-09-22T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: 3, description: 'Teachers who marked this task done' })
  completedCount!: number;

  @ApiProperty({
    example: 12,
    description: 'Active teachers in the school at create/list time',
  })
  teacherCount!: number;
}

export class DashboardTeacherTasksResponseDto {
  @ApiProperty({ type: [DashboardTeacherTaskItemDto] })
  items!: DashboardTeacherTaskItemDto[];

  @ApiProperty({
    example: { page: 1, limit: 10, total: 2, totalPages: 1 },
  })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
