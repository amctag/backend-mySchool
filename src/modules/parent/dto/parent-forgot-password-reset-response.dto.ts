import { ApiProperty } from '@nestjs/swagger';

export class ParentForgotPasswordResetResponseDto {
  @ApiProperty({ example: 'Password reset successfully' })
  message!: string;
}
