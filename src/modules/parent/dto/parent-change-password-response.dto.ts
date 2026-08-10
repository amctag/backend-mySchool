import { ApiProperty } from '@nestjs/swagger';

export class ParentChangePasswordResponseDto {
  @ApiProperty({ example: 'Password changed successfully' })
  message!: string;
}
