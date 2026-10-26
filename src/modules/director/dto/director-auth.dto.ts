import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class DirectorLoginDto {
  @ApiProperty({
    example: 42,
    description: 'Person ID or director ID used to sign in',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'School to open the session in when the director belongs to more than one school. Defaults to the first active school.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schoolId?: number;

  @ApiPropertyOptional({
    description:
      'Firebase Cloud Messaging device token. Optional — omit when the device has no token yet.',
    example: 'dXNlci1kZXZpY2UtdG9rZW4',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  fcmToken?: string;
}

export class DirectorRefreshDto {
  @ApiProperty({ example: 'a1b2c3d4e5f6...' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class DirectorTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'a1b2c3d4e5f6...' })
  refreshToken!: string;

  @ApiProperty({ example: '2026-09-08T10:30:00.000Z' })
  accessTokenExpiresAt!: string;

  @ApiProperty({ example: '2026-09-15T10:15:00.000Z' })
  refreshTokenExpiresAt!: string;
}

export class DirectorRefreshResponseDto extends DirectorTokenResponseDto {}

export class DirectorLoginResponseDto extends DirectorTokenResponseDto {
  @ApiProperty({ example: 1 })
  directorId!: number;

  @ApiProperty({ example: 8 })
  personId!: number;

  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: 'sara.nasser' })
  username!: string;

  @ApiProperty({ example: 'Sara Ali Nasser' })
  name!: string;

  @ApiProperty({ example: 'sara.nasser@example.com', nullable: true })
  email!: string | null;

  @ApiProperty({ example: '+96170000003', nullable: true })
  phoneNumber!: string | null;

  @ApiProperty({ example: ['director'], type: [String] })
  roles!: string[];
}

export class DirectorLogoutResponseDto {
  @ApiProperty({ example: 'Logged out successfully' })
  message!: string;
}

export class DirectorFcmTokenDto {
  @ApiProperty({
    description: 'Firebase Cloud Messaging device or browser token',
    example: 'dXNlci1kZXZpY2UtdG9rZW4',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token!: string;
}

export class DirectorMeResponseDto {
  @ApiProperty({ example: 1 })
  directorId!: number;

  @ApiProperty({ example: 8 })
  personId!: number;

  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: 'sara.nasser' })
  username!: string;

  @ApiProperty({ example: 'Sara Ali Nasser' })
  name!: string;

  @ApiProperty({ example: 'sara.nasser@example.com', nullable: true })
  email!: string | null;

  @ApiProperty({ example: '+96170000003', nullable: true })
  phoneNumber!: string | null;

  @ApiProperty({ example: ['director'], type: [String] })
  roles!: string[];
}