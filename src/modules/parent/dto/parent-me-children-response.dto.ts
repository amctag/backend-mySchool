import { ApiProperty } from '@nestjs/swagger';

export class ParentChildRegistrationDto {
  @ApiProperty({ example: 1 })
  sectionId: number;

  @ApiProperty({ example: '4A' })
  className: string;

  @ApiProperty({ example: 'Section A' })
  sectionTitle: string;

  @ApiProperty({ example: '2025-2026' })
  yearTitle: string;

  @ApiProperty({ example: 1 })
  schoolId: number;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName: string;
}

export class ParentChildDetailDto {
  @ApiProperty({ example: 1 })
  studentId: number;

  @ApiProperty({ example: 2 })
  personId: number;

  @ApiProperty({ example: 1001, nullable: true })
  registerId: number | null;

  @ApiProperty({ example: 'layla.khalil' })
  username: string;

  @ApiProperty({ example: 'Layla' })
  firstName: string;

  @ApiProperty({ example: 'Ahmad' })
  middleName: string;

  @ApiProperty({ example: 'Khalil' })
  lastName: string;

  @ApiProperty({ example: 'Layla Ahmad Khalil' })
  name: string;

  @ApiProperty({ example: 'layla.khalil@example.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: 1, nullable: true })
  gender: number | null;

  @ApiProperty({ example: '2015-09-01T00:00:00.000Z', nullable: true })
  birthday: string | null;

  @ApiProperty({ example: 1 })
  schoolId: number;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName: string;

  @ApiProperty({ example: 'Maya', nullable: true })
  motherName: string | null;

  @ApiProperty({ example: 'Hassan', nullable: true })
  motherFamily: string | null;

  @ApiProperty({ example: '+96170000002', nullable: true })
  motherPhone: string | null;

  @ApiProperty({ type: ParentChildRegistrationDto, nullable: true })
  registration: ParentChildRegistrationDto | null;
}

export class ParentMeChildDetailResponseDto extends ParentChildDetailDto {}
