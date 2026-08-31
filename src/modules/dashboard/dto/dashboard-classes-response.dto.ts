import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { DashboardClassItemDto } from './dashboard-class-item.dto';

export class DashboardClassesResponseDto {
  @ApiProperty({ type: [DashboardClassItemDto] })
  items!: DashboardClassItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
