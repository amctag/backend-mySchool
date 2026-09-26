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

  @ApiProperty({ example: 'Hamra Street, Beirut, Lebanon', nullable: true })
  address!: string | null;

  @ApiProperty({ example: '+961 70 000 001', nullable: true })
  phoneNumber!: string | null;

  @ApiProperty({ example: '1985-03-15', nullable: true })
  birthday!: string | null;

  @ApiProperty({ example: 2 })
  childrenCount!: number;

  @ApiProperty({ example: true })
  status!: boolean;

  @ApiProperty({
    example: true,
    description: 'Legacy person payment flag retained for API compatibility',
  })
  paid!: boolean;

  @ApiProperty({ example: 42, nullable: true })
  accountId!: number | null;

  @ApiProperty({ example: true })
  hasAccountingAccount!: boolean;

  @ApiProperty({ example: '100001', nullable: true })
  accountCode!: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether this school owns the parent Person and may create its account',
  })
  canCreateAccountingAccount!: boolean;
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

  @ApiProperty({ example: 'Ahmad' })
  firstName!: string;

  @ApiProperty({ example: 'Hassan' })
  middleName!: string;

  @ApiProperty({ example: 'Khalil' })
  lastName!: string;
}
