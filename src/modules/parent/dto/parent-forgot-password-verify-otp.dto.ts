import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class ParentForgotPasswordVerifyOtpDto {
  @ApiProperty({ example: 'ahmad.khalil', description: 'Parent username' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  username!: string;

  @ApiProperty({ example: '123456', description: '6-digit code sent to email' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'otp must be a 6-digit number' })
  otp!: string;
}
