import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardStudentDetailDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 1 })
  parentId!: number;

  @ApiProperty({ example: 'Ahmad Hassan Khalil' })
  parentName!: string;

  @ApiProperty({ example: 'Omar' })
  firstName!: string;

  @ApiProperty({ example: 'Ahmad' })
  middleName!: string;

  @ApiProperty({ example: 'Khalil' })
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

  @ApiPropertyOptional({ nullable: true, example: '2015-03-15' })
  birthday!: string | null;

  @ApiPropertyOptional({ nullable: true })
  motherName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  motherFamily!: string | null;

  @ApiPropertyOptional({ nullable: true })
  motherPhone!: string | null;
}
