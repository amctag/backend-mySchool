import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class SendParentFcmTestDto {
  @ApiPropertyOptional({ example: 'Test notification' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 'This is a test from My School.' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body?: string;
}

export class SendParentFcmTestResponseDto {
  @ApiProperty({ example: true })
  sent: boolean;

  @ApiProperty({ example: 12 })
  personId: number;

  @ApiProperty({ example: 'projects/taaruf-f15c3/messages/0:123' })
  messageId: string;
}
