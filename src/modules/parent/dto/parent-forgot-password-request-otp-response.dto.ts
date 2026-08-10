import { ApiProperty } from '@nestjs/swagger';

export class ParentForgotPasswordRequestOtpResponseDto {
  @ApiProperty({
    example:
      'If an account with this username exists, a verification code was sent to the registered email',
  })
  message!: string;

  @ApiProperty({ example: 'a***@example.com', nullable: true })
  email!: string | null;

  @ApiProperty({ example: 10 })
  expiresInMinutes!: number;
}
