import { ApiProperty } from '@nestjs/swagger';

export class ParentForgotPasswordVerifyOtpResponseDto {
  @ApiProperty({ example: 'Verification code confirmed' })
  message!: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Short-lived token required to set a new password',
  })
  resetToken!: string;

  @ApiProperty({ example: 15 })
  expiresInMinutes!: number;
}
