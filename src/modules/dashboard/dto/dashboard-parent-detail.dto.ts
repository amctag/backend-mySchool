import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardParentDetailDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Ahmad' })
  firstName!: string;

  @ApiProperty({ example: 'Hassan' })
  middleName!: string;

  @ApiProperty({ example: 'Khalil' })
  lastName!: string;

  @ApiPropertyOptional({ nullable: true })
  gender!: number | null;

  @ApiPropertyOptional({ nullable: true })
  nationalityId!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Governorate id; same value as register_id',
  })
  governorateId!: number | null;

  @ApiPropertyOptional({ nullable: true })
  registerId!: number | null;

  @ApiPropertyOptional({ nullable: true })
  regionId!: number | null;

  @ApiPropertyOptional({ nullable: true })
  currentJobId!: number | null;

  @ApiPropertyOptional({ nullable: true })
  identityNumber!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phoneNumber!: string | null;

  @ApiPropertyOptional({ nullable: true })
  urgentNumber!: string | null;

  @ApiPropertyOptional({ nullable: true })
  landline!: string | null;

  @ApiPropertyOptional({ nullable: true })
  address!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1985-03-15' })
  birthday!: string | null;
}
