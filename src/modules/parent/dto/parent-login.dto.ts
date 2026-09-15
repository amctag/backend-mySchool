import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class ParentLoginDto {
  @ApiProperty({
    example: 42,
    description: 'Person ID or parent ID used to sign in',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;

  @ApiProperty({ example: 'password123', description: 'Account password' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({
    description:
      'Firebase Cloud Messaging device token. Optional — omit when the device has no token yet.',
    example: 'dXNlci1kZXZpY2UtdG9rZW4',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  fcmToken?: string;
}
