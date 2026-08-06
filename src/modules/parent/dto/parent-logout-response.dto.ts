import { ApiProperty } from '@nestjs/swagger';

export class ParentLogoutResponseDto {
  @ApiProperty({ example: 'Logged out successfully' })
  message: string;
}
