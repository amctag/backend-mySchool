import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpsertParentFcmTokenDto {
  @ApiProperty({
    description: 'Firebase Cloud Messaging device token',
    example: 'dXNlci1kZXZpY2UtdG9rZW4',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;
}

export class ParentFcmTokenResponseDto {
  @ApiProperty({ example: 12 })
  personId: number;

  @ApiProperty({ example: 'dXNlci1kZXZpY2UtdG9rZW4' })
  token: string;
}
