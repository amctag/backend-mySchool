import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class DashboardAnnouncementsQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Filter announcements by creator person id',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  personId?: number;
}
