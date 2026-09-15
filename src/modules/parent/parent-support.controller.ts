import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ParentSchoolDetailsResponseDto } from './dto/parent-school-details-response.dto';
import { ParentSupportSchoolsDto } from './dto/parent-support-schools.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Auth v1')
@Controller({ path: 'parent', version: '1' })
export class ParentSupportController {
  constructor(private readonly parentService: ParentService) {}

  @Public()
  @Post('support/schools')
  @ApiOperation({
    summary: 'Look up school contact details for parent support',
    description:
      'Resolves a parent person ID to their children’s schools without requiring a password.',
  })
  @ApiOkResponse({ type: ParentSchoolDetailsResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'Could not find support information' })
  getSupportSchools(
    @Body() dto: ParentSupportSchoolsDto,
  ): Promise<ParentSchoolDetailsResponseDto> {
    return this.parentService.getSupportSchools(dto);
  }
}
