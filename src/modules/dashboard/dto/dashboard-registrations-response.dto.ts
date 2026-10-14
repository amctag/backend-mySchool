import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardRegistrationItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  studentId!: number;

  @ApiProperty({
    example: 'Layla Fadi Haddad',
    description:
      'Canonical student name: student first name + father first name + family name (from the linked Parent record)',
  })
  studentName!: string;

  @ApiProperty({ example: 'Layla', nullable: true })
  studentFirstName!: string | null;

  @ApiProperty({ example: 'Fadi', nullable: true })
  fatherFirstName!: string | null;

  @ApiProperty({ example: 'Haddad', nullable: true })
  familyName!: string | null;

  @ApiProperty({ example: 'Layla Fadi Haddad' })
  studentFullName!: string;

  @ApiProperty({ example: 1 })
  classId!: number;

  @ApiProperty({ example: 'Grade 4' })
  className!: string;

  @ApiProperty({ example: 4 })
  classLevel!: number;

  @ApiProperty({ example: 1 })
  sectionId!: number;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2026-2027' })
  yearTitle!: string;

  @ApiProperty({ example: '2026-09-01T10:00:00.000Z' })
  createdAt!: string;
}

export class DashboardRegistrationsResponseDto {
  @ApiProperty({ type: [DashboardRegistrationItemDto] })
  items!: DashboardRegistrationItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
