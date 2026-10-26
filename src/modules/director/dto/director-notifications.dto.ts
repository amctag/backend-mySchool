import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class DirectorNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  date?: string;
}

export class DirectorNotificationItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '2025-01-15' })
  createdAt!: string;

  @ApiProperty({ example: 'New assignment' })
  title!: string;

  @ApiProperty({ type: 'string', format: 'html', example: '<p>You have a new assignment</p>' })
  body!: string;

  @ApiProperty({ example: 'assignment' })
  type!: string;

  @ApiProperty({ example: '/teacher/tasks/1' })
  route!: string;
}

export class DirectorNotificationsResponseDto {
  @ApiProperty({ type: [DirectorNotificationItemDto] })
  notifications!: DirectorNotificationItemDto[];
}