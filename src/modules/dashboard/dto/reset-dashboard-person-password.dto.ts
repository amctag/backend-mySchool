import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetDashboardPersonPasswordDto {
  @ApiProperty({ example: 'newSecurePass1', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword!: string;

  @ApiProperty({ example: 'newSecurePass1', minLength: 6 })
  @IsString()
  @MinLength(6)
  confirmPassword!: string;
}

export class ResetDashboardPersonPasswordResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty({ example: true })
  reset!: boolean;
}
