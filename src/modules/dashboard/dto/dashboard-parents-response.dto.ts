import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardParentItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Ahmad Hassan Khalil' })
  fullName!: string;

  @ApiProperty({ example: 'Ahmad' })
  firstName!: string;

  @ApiProperty({ example: 'Khalil' })
  lastName!: string;

  @ApiProperty({ example: null, nullable: true })
  picture!: string | null;

  @ApiProperty({ example: 'Hamra Street, Beirut, Lebanon', nullable: true })
  address!: string | null;

  @ApiProperty({ example: '+961 70 000 001', nullable: true })
  phoneNumber!: string | null;

  @ApiProperty({ example: 2 })
  childrenCount!: number;
}

export class DashboardParentsResponseDto {
  @ApiProperty({ type: [DashboardParentItemDto] })
  items!: DashboardParentItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class DashboardParentOptionDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Ahmad Hassan Khalil' })
  fullName!: string;

  @ApiProperty({ example: 'Khalil' })
  lastName!: string;
}
