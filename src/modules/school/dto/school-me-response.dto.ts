import { ApiProperty } from '@nestjs/swagger';

export class SchoolMeResponseDto {
  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({ example: 'Green Valley School' })
  name!: string;

  @ApiProperty({ example: 'school@greenvalley.edu' })
  email!: string;

  @ApiProperty({ example: 'school' })
  role!: 'school';
}
