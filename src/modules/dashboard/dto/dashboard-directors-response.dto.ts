import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardDirectorItemDto {
  @ApiProperty({ example: 12, description: 'Director id (director.id)' })
  id!: number;

  @ApiProperty({
    example: 669,
    description: 'Linked persons.id used by the Director app to sign in',
  })
  personId!: number;

  @ApiProperty({ example: 'Sara Nabil Haddad' })
  fullName!: string;

  @ApiProperty({ example: 'Sara' })
  firstName!: string;

  @ApiProperty({ example: 'Haddad' })
  lastName!: string;

  @ApiProperty({ example: '+961 71 000 010', nullable: true })
  phoneNumber!: string | null;

  @ApiProperty({ example: 'sara@example.com', nullable: true })
  email!: string | null;

  @ApiProperty({ example: 'Hamra Street, Beirut', nullable: true })
  address!: string | null;

  @ApiProperty({ example: '1988-04-12', nullable: true })
  birthday!: string | null;

  @ApiProperty({ example: true })
  status!: boolean;

  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: true })
  isActiveInSchool!: boolean;
}

export class DashboardDirectorsResponseDto {
  @ApiProperty({ type: [DashboardDirectorItemDto] })
  items!: DashboardDirectorItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
