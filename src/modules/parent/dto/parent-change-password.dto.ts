import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches, MinLength } from 'class-validator';

export class ParentChangePasswordDto {
  @ApiProperty({ example: '123456', description: '6-digit code sent to email' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'otp must be a 6-digit number' })
  otp!: string;

  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(6)
  newPassword!: string;

  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(6)
  confirmPassword!: string;
}
