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

export class CreateDashboardTeacherDto {
  @ApiProperty({ example: 'Sara' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiPropertyOptional({ example: 'Nabil' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @ApiProperty({ example: 'Haddad' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiPropertyOptional({ example: 1, description: '0 = male, 1 = female' })
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

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  governorateId?: number;

  @ApiPropertyOptional({ example: 2045 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  registerId?: number | null;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  regionId?: number;

  @ApiPropertyOptional({ example: 'LB-12345678' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50)
  identityNumber?: string;

  @ApiPropertyOptional({ example: 'sara@example.com' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({ example: '+961 71 000 010' })
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

  @ApiPropertyOptional({ example: 'Hamra' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(255)
  village?: string;

  @ApiPropertyOptional({ example: 'Beirut' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(255)
  placeOfBirth?: string;

  @ApiPropertyOptional({ example: '1988-04-12' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  birthday?: string;
}
