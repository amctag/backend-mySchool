import { ApiProperty } from '@nestjs/swagger';

export class SchoolMeResponseDto {
  @ApiProperty({ example: 1 })
  personId!: number;

  @ApiProperty({ example: 'admin.green' })
  username!: string;

  @ApiProperty({ example: 'Rania' })
  firstName!: string;

  @ApiProperty({ example: 'Fadi' })
  middleName!: string;

  @ApiProperty({ example: 'Admin' })
  lastName!: string;

  @ApiProperty({ example: 'Rania Fadi Admin' })
  name!: string;

  @ApiProperty({ example: 'admin@greenvalley.edu', nullable: true })
  email!: string | null;

  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: 'school' })
  role!: 'school';
}
