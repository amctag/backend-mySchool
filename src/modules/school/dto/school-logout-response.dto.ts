import { ApiProperty } from '@nestjs/swagger';

export class SchoolLogoutResponseDto {
  @ApiProperty({ example: 'Logged out successfully' })
  message!: string;
}
