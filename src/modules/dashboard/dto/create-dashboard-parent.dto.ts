import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export class CreateDashboardParentDto {
  @ApiProperty({ example: 'Ahmad' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({ example: 'Hassan' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @ApiProperty({ example: 'Khalil' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional({ example: 0, description: '0 = male, 1 = female' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  gender?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nationalityId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Home governorate; also stored as register_id',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  governorateId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  regionId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  currentJobId?: number;

  @ApiPropertyOptional({ example: 'LB-12345678' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50)
  identityNumber?: string;

  @ApiPropertyOptional({ example: 'ahmad@example.com' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({ example: '+961 70 000 001' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  phoneNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50)
  urgentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50)
  landline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(2000)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ example: '2010-01-15' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  birthday?: string;
}
