import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class SendDashboardFcmTestDto {
  @ApiProperty({ example: 12, description: 'Person id of the logged-in parent' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  personId!: number;

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

export class SendDashboardFcmTestResponseDto {
  @ApiProperty({ example: true })
  sent: boolean;

  @ApiProperty({ example: 12 })
  personId: number;

  @ApiProperty({ example: 'projects/taaruf-f15c3/messages/0:123' })
  messageId: string;
}
