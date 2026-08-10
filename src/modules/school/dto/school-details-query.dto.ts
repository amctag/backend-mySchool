import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class SchoolDetailsQueryDto {
  @ApiProperty({ example: 1, description: 'School id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  schoolId!: number;
}
