import { ApiProperty } from '@nestjs/swagger';

export class LookupItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Lebanese' })
  name!: string;

  @ApiProperty({ example: true, required: false })
  isDefault?: boolean;
}

export class GovernorateItemDto extends LookupItemDto {
  @ApiProperty({
    example: 1,
    description: 'Custom number used as persons.governorate_id',
  })
  code!: number;
}

export class RegionItemDto extends LookupItemDto {
  @ApiProperty({ example: 1 })
  governorateId!: number;
}

