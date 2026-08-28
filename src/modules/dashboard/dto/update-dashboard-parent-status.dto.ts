import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdateDashboardParentStatusDto {
  @ApiProperty({
    example: false,
    description: 'false = closed (orange ring), true = active',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 1 || value === '1' || value === 'true') {
      return true;
    }
    if (value === false || value === 0 || value === '0' || value === 'false') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  status!: boolean;
}

export class DashboardParentStatusDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: false })
  status!: boolean;
}
