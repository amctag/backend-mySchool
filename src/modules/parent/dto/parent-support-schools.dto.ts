import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ParentSupportSchoolsDto {
  @ApiProperty({ example: 42, description: 'Person ID of the parent' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}
