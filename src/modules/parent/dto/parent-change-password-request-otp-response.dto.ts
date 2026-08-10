import { ApiProperty } from '@nestjs/swagger';

export class ParentChangePasswordRequestOtpResponseDto {
  @ApiProperty({ example: 'Verification code sent to your email' })
  message!: string;

  @ApiProperty({ example: 'a***@example.com' })
  email!: string;

  @ApiProperty({ example: 10 })
  expiresInMinutes!: number;
}
