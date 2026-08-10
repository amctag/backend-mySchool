import { ApiProperty } from '@nestjs/swagger';
import { SchoolDetailsResponseDto } from '../../school/dto/school-details-response.dto';

export class ParentSchoolDetailsResponseDto {
  @ApiProperty({ type: [SchoolDetailsResponseDto] })
  schools!: SchoolDetailsResponseDto[];
}
