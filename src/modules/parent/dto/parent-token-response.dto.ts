import { ApiProperty } from '@nestjs/swagger';

export class ParentTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'a1b2c3d4e5f6...' })
  refreshToken: string;

  @ApiProperty({ example: '2026-08-06T10:30:00.000Z' })
  accessTokenExpiresAt: string;

  @ApiProperty({ example: '2026-08-13T10:15:00.000Z' })
  refreshTokenExpiresAt: string;
}
