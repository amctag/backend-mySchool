import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedParent } from '../../auth/interfaces/jwt-payload.interface';
import { ParentSchoolDetailsQueryDto } from './dto/parent-school-details-query.dto';
import { ParentSchoolDetailsResponseDto } from './dto/parent-school-details-response.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Profile v1')
@Controller({ path: 'parent', version: '1' })
export class ParentSchoolDetailsController {
  constructor(private readonly parentService: ParentService) {}

  @Get('me/school-details')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get school contact and about information for the parent children schools',
    description:
      'Returns school_details rows for schools linked to the parent children. ' +
      'Pass studentId to filter by one child, or omit for all relevant schools.',
  })
  @ApiOkResponse({ type: ParentSchoolDetailsResponseDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getSchoolDetails(
    @Req() request: Request & { user: AuthenticatedParent },
    @Query() query: ParentSchoolDetailsQueryDto,
  ): Promise<ParentSchoolDetailsResponseDto> {
    return this.parentService.getSchoolDetails(request.user, query.studentId);
  }
}
