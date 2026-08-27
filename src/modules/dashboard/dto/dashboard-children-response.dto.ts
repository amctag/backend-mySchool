import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardChildItemDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 'Omar Ahmad Khalil' })
  fullName!: string;

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
