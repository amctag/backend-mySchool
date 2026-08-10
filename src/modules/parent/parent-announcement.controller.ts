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
import { ParentAnnouncementsQueryDto } from './dto/parent-announcements-query.dto';
import { ParentAnnouncementsResponseDto } from './dto/parent-announcements-response.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Announcements v1')
@Controller({ path: 'parent', version: '1' })
export class ParentAnnouncementController {
  constructor(private readonly parentService: ParentService) {}

  @Get('me/announcements')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get announcements for the logged-in parent',
    description:
      'Returns published announcements targeted to parents that match the parent children sections. ' +
      'Pass studentId to filter by one child, or omit for all relevant announcements.',
  })
  @ApiOkResponse({ type: ParentAnnouncementsResponseDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getAnnouncements(
    @Req() request: Request & { user: AuthenticatedParent },
    @Query() query: ParentAnnouncementsQueryDto,
  ): Promise<ParentAnnouncementsResponseDto> {
    return this.parentService.getAnnouncements(request.user, query.studentId);
  }
}
