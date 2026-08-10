import { ApiProperty } from '@nestjs/swagger';

export class SchoolDetailsResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: '+961 1 234 567' })
  telephone!: string;

  @ApiProperty({ example: '+961 70 123 456' })
  phone!: string;

  @ApiProperty({ example: '+961 1 234 568' })
  fax!: string;

  @ApiProperty({ example: 'Main Street, Beirut, Lebanon' })
  address!: string;

  @ApiProperty({ example: 'info@greenvalley.edu' })
  email!: string;

  @ApiProperty({ example: 'https://greenvalley.edu' })
  website!: string;

  @ApiProperty({ example: 'Green Valley School provides quality education for all students.' })
  about!: string;
}
