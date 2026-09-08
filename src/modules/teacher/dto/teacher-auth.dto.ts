import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class TeacherLoginDto {
  @ApiProperty({
    example: 'sara.nasser',
    description: 'Teacher username',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'School to open the session in when the teacher belongs to more than one school. Defaults to the first active school.',
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

export class TeacherRefreshDto {
  @ApiProperty({ example: 'a1b2c3d4e5f6...' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class TeacherTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'a1b2c3d4e5f6...' })
  refreshToken!: string;

  @ApiProperty({ example: '2026-09-08T10:30:00.000Z' })
  accessTokenExpiresAt!: string;

  @ApiProperty({ example: '2026-09-15T10:15:00.000Z' })
  refreshTokenExpiresAt!: string;
}

export class TeacherLoginResponseDto extends TeacherTokenResponseDto {
  @ApiProperty({ example: 1 })
  teacherId!: number;

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

  @ApiProperty({ example: ['teacher'], type: [String] })
  roles!: string[];
}

export class TeacherRefreshResponseDto extends TeacherTokenResponseDto {}

export class TeacherLogoutResponseDto {
  @ApiProperty({ example: 'Logged out successfully' })
  message!: string;
}

export class TeacherMessageResponseDto {
  @ApiProperty({ example: 'Deleted successfully' })
  message!: string;
}
