import { ApiProperty } from '@nestjs/swagger';

export class DashboardParentAccountDto {
  @ApiProperty({ example: 42 })
  accountId!: number;

  @ApiProperty({ example: '100001' })
  accountCode!: string;

  @ApiProperty({ example: true })
  hasAccountingAccount!: true;
}
