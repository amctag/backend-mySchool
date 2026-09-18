import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class TeacherSupportSchoolsDto {
  @ApiProperty({
    example: 42,
    description: 'Person ID or teacher ID used to look up school support details',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}
