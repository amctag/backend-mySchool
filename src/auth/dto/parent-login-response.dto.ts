import { ApiProperty } from '@nestjs/swagger';
import { ParentTokenResponseDto } from './parent-token-response.dto';

export class ParentLoginResponseDto extends ParentTokenResponseDto {
  @ApiProperty({ example: 'Ahmad Hassan Khalil' })
  name: string;
}
