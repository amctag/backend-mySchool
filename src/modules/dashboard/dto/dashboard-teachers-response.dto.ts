import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardTeacherItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Sara Nabil Haddad' })
  fullName!: string;

  @ApiProperty({ example: 'Sara' })
  firstName!: string;

  @ApiProperty({ example: 'Haddad' })
  lastName!: string;

  @ApiProperty({ example: '+961 71 000 010', nullable: true })
  phoneNumber!: string | null;

  @ApiProperty({ example: 'Hamra Street, Beirut', nullable: true })
  address!: string | null;

  @ApiProperty({ example: '1988-04-12', nullable: true })
  birthday!: string | null;

  @ApiProperty({ example: true })
  status!: boolean;
}

export class DashboardTeachersResponseDto {
  @ApiProperty({ type: [DashboardTeacherItemDto] })
  items!: DashboardTeacherItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
