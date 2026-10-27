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
import {
  PG_INT4_MAX,
  REGISTER_ID_MAX,
  REGISTER_ID_MIN,
  REGISTER_ID_RANGE_MESSAGE,
} from '../../../common/constants/database-limits';

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

/**
 * Fields shared by every dashboard "person" form (teacher, director, ...).
 * The values map 1:1 to the `persons` table, so the limits below are the real
 * column limits rather than arbitrary business rules.
 */
export class CreateDashboardPersonProfileDto {
  @ApiProperty({ example: 'Sara' })
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  @MaxLength(100, { message: 'First name must be 100 characters or fewer' })
  firstName!: string;

  @ApiPropertyOptional({ example: 'Nabil' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100, { message: 'Middle name must be 100 characters or fewer' })
  middleName?: string;

  @ApiProperty({ example: 'Haddad' })
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Family name is required' })
  @MaxLength(100, { message: 'Family name must be 100 characters or fewer' })
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
  @Max(PG_INT4_MAX)
  nationalityId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PG_INT4_MAX)
  governorateId?: number;

  /**
   * `persons.register_id` is an INT4 column. Values above 2,147,483,647 make
   * PostgreSQL raise an out-of-range error (Prisma P2020), so they are rejected
   * here with an explicit message before any write happens.
   */
  @ApiPropertyOptional({
    example: 2045,
    description: 'Numeric register id stored in persons.register_id (INT4)',
    minimum: REGISTER_ID_MIN,
    maximum: REGISTER_ID_MAX,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: REGISTER_ID_RANGE_MESSAGE })
  @Min(REGISTER_ID_MIN, { message: REGISTER_ID_RANGE_MESSAGE })
  @Max(REGISTER_ID_MAX, { message: REGISTER_ID_RANGE_MESSAGE })
  registerId?: number | null;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PG_INT4_MAX)
  regionId?: number;

  /**
   * Identity numbers are identifiers, not numbers: they stay strings so leading
   * zeros and letters are preserved. Only the column length is enforced.
   */
  @ApiPropertyOptional({ example: 'LB-12345678' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50, {
    message: 'Identity number must be 50 characters or fewer',
  })
  identityNumber?: string;

  @ApiPropertyOptional({ example: 'sara@example.com' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(255, { message: 'Email must be 255 characters or fewer' })
  email?: string;

  @ApiProperty({ example: '+961 71 000 010' })
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: 'Phone number is required' })
  @MaxLength(50, { message: 'Phone number must be 50 characters or fewer' })
  phoneNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50, { message: 'Urgent number must be 50 characters or fewer' })
  urgentNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(50, { message: 'Landline must be 50 characters or fewer' })
  landline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(2000, { message: 'Address must be 2000 characters or fewer' })
  address?: string;

  @ApiPropertyOptional({ example: 'Hamra' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(255, { message: 'Village must be 255 characters or fewer' })
  village?: string;

  @ApiPropertyOptional({ example: 'Beirut' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(255, {
    message: 'Place of birth must be 255 characters or fewer',
  })
  placeOfBirth?: string;

  @ApiPropertyOptional({ example: '1988-04-12' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  birthday?: string;
}
