import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ParentLoginDto {
  @ApiProperty({ example: 'ahmad.khalil', description: 'Parent username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password123', description: 'Account password' })
  @IsString()
  @MinLength(6)
  password: string;
}
