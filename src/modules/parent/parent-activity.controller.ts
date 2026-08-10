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
import { ParentActivitiesQueryDto } from './dto/parent-activities-query.dto';
import { ParentActivitiesResponseDto } from './dto/parent-activities-response.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Activities v1')
@Controller({ path: 'parent', version: '1' })
export class ParentActivityController {
  constructor(private readonly parentService: ParentService) {}

  @Get('me/activities')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get activities for the logged-in parent',
    description:
      'Returns school activities matching the parent children academic years. ' +
      'Pass studentId to filter by one child, or omit for all relevant activities.',
  })
  @ApiOkResponse({ type: ParentActivitiesResponseDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getActivities(
    @Req() request: Request & { user: AuthenticatedParent },
    @Query() query: ParentActivitiesQueryDto,
  ): Promise<ParentActivitiesResponseDto> {
    return this.parentService.getActivities(request.user, query.studentId);
  }
}
