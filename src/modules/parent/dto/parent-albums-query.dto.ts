import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ParentAlbumsQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter by child student id. Omit to return albums for all schools linked to your children.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId?: number;
}

export class ParentAlbumDetailQueryDto {
  @ApiPropertyOptional({
    description: 'Optional child student id used to verify access to the album school.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId?: number;
}
