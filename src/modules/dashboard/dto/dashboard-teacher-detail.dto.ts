import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardTeacherDetailDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Sara' })
  firstName!: string;

  @ApiProperty({ example: 'Nabil' })
  middleName!: string;

  @ApiProperty({ example: 'Haddad' })
  lastName!: string;

  @ApiPropertyOptional({ nullable: true })
  gender!: number | null;

  @ApiPropertyOptional({ nullable: true })
  nationalityId!: number | null;

  @ApiPropertyOptional({ nullable: true })
  governorateId!: number | null;

  @ApiPropertyOptional({ nullable: true })
  registerId!: number | null;

  @ApiPropertyOptional({ nullable: true })
  regionId!: number | null;

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
  village!: string | null;

  @ApiPropertyOptional({ nullable: true })
  placeOfBirth!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1988-04-12' })
  birthday!: string | null;
}
