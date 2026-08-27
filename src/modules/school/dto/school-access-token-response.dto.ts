import { ApiProperty } from '@nestjs/swagger';

export class SchoolAccessTokenResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ example: '2026-08-26T12:00:00.000Z' })
  accessTokenExpiresAt!: string;

  @ApiProperty({ example: 'Rania Fadi Admin' })
  name!: string;

  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;
}
