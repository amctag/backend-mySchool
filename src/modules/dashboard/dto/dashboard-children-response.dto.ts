import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardChildItemDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({
    example: 669,
    description: 'Linked persons.id used for app login',
  })
  personId!: number;

  @ApiProperty({
    example: 'Omar Ahmad Khalil',
    description:
      'Canonical student name: student first name + father first name + family name (from the linked Parent record)',
  })
  fullName!: string;

  @ApiProperty({ example: 'Omar', nullable: true })
  studentFirstName!: string | null;

  @ApiProperty({ example: 'Ahmad', nullable: true })
  fatherFirstName!: string | null;

  @ApiProperty({ example: 'Khalil', nullable: true })
  familyName!: string | null;

  @ApiProperty({ example: 'Omar Ahmad Khalil' })
  studentFullName!: string;

  @ApiProperty({ example: 'Omar' })
  firstName!: string;

  @ApiProperty({ example: 'Khalil' })
  lastName!: string;

  @ApiProperty({ example: 'omar.khalil' })
  username!: string;

  @ApiProperty({ example: 1, nullable: true })
  parentId!: number | null;

  @ApiProperty({ example: 'Ahmad Hassan Khalil', nullable: true })
  parentName!: string | null;

  @ApiProperty({ example: 3, nullable: true })
  classId!: number | null;

  @ApiProperty({ example: 'Grade 4', nullable: true })
  className!: string | null;

  @ApiProperty({ example: 'A', nullable: true })
  sectionName!: string | null;

  @ApiProperty({ example: '2025-2026', nullable: true })
  yearTitle!: string | null;

  @ApiProperty({ example: '2015-09-01', nullable: true })
  birthday!: string | null;

  @ApiProperty({ example: 'Hamra Street, Beirut', nullable: true })
  address!: string | null;

  @ApiProperty({ example: '+961 70 000 001', nullable: true })
  phoneNumber!: string | null;
}

export class DashboardChildrenResponseDto {
  @ApiProperty({ type: [DashboardChildItemDto] })
  items!: DashboardChildItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
