import { ApiProperty } from '@nestjs/swagger';

export class SchoolMeResponseDto {
  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({ example: 'Green Valley School' })
  name!: string;

  @ApiProperty({ example: 'school@greenvalley.edu' })
  email!: string;

  @ApiProperty({ example: 'school' })
  role!: 'school';

  @ApiProperty({ required: false, nullable: true })
  logo!: string | null;

  @ApiProperty({ required: false, nullable: true })
  phone!: string | null;

  @ApiProperty({ required: false, nullable: true })
  address!: string | null;
}
