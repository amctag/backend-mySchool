import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class TeacherMeResponseDto {
  @ApiProperty({ example: 8 })
  personId!: number;

  @ApiProperty({ example: 1 })
  teacherId!: number;

  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: 'sara.nasser' })
  username!: string;

  @ApiProperty({ example: 'Sara' })
  firstName!: string;

  @ApiProperty({ example: 'Ali' })
  middleName!: string;

  @ApiProperty({ example: 'Nasser' })
  lastName!: string;

  @ApiProperty({ example: 'Sara Ali Nasser' })
  name!: string;

  @ApiProperty({ example: 'sara.nasser@example.com', nullable: true })
  email!: string | null;

  @ApiProperty({ example: '+96170000003', nullable: true })
  phoneNumber!: string | null;

  @ApiProperty({ example: ['teacher'], type: [String] })
  roles!: string[];
}

export class TeacherChangePasswordDto {
  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(6)
  newPassword!: string;

  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(6)
  confirmPassword!: string;
}

export class TeacherChangePasswordResponseDto {
  @ApiProperty({ example: 'Password changed successfully' })
  message!: string;
}
