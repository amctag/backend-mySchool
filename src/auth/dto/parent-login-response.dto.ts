import { ApiProperty } from '@nestjs/swagger';

export class ParentStudentDto {
  @ApiProperty({ example: 3 })
  studentId: number;

  @ApiProperty({ example: 4 })
  personId: number;

  @ApiProperty({ example: 'Layla' })
  firstName: string;

  @ApiProperty({ example: 'Khalil' })
  lastName: string;

  @ApiProperty({ example: 'layla.khalil' })
  username: string;

  @ApiProperty({ example: 1, nullable: true })
  schoolId: number | null;
}

export class ParentProfileDto {
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

  @ApiProperty({ example: 'ahmad.khalil@example.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: null, nullable: true })
  schoolId: number | null;
}

export class ParentLoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ type: ParentProfileDto })
  parent: ParentProfileDto;

  @ApiProperty({ type: [ParentStudentDto] })
  children: ParentStudentDto[];
}
