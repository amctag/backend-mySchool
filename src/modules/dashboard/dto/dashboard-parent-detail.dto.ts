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
    description: 'Governorate table id (selected by name)',
  })
  governorateId!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Free register number; not related to any table',
  })
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

  @ApiPropertyOptional({ nullable: true })
  village!: string | null;

  @ApiPropertyOptional({ nullable: true })
  placeOfBirth!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1985-03-15' })
  birthday!: string | null;
}
