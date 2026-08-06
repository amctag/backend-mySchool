import { ApiProperty } from '@nestjs/swagger';

export class ParentMeResponseDto {
  @ApiProperty({ example: 1 })
  personId: number;

  @ApiProperty({ example: 1 })
  parentId: number;

  @ApiProperty({ example: 'ahmad.khalil' })
  username: string;

  @ApiProperty({ example: 'Ahmad' })
  firstName: string;

  @ApiProperty({ example: 'Hassan' })
  middleName: string;

  @ApiProperty({ example: 'Khalil' })
  lastName: string;

  @ApiProperty({ example: 'Ahmad Hassan Khalil' })
  name: string;

  @ApiProperty({ example: 'ahmad.khalil@example.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: '+96170000001', nullable: true })
  phoneNumber: string | null;

  @ApiProperty({ example: null, nullable: true })
  schoolId: number | null;

  @ApiProperty({ example: 2 })
  childrenCount: number;
}
