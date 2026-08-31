import { Controller, Get, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DashboardAnnouncementItemDto,
  DashboardAnnouncementsResponseDto,
} from './dto/dashboard-announcements-response.dto';
import { DashboardAnnouncementsService } from './dashboard-announcements.service';
import { DashboardAnnouncementsQueryDto } from './dto/dashboard-announcements-query.dto';

@ApiTags('Dashboard Announcements v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/announcements', version: '1' })
export class DashboardAnnouncementsController {
  constructor(
    private readonly dashboardAnnouncementsService: DashboardAnnouncementsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List announcements for this school' })
  @ApiOkResponse({ type: DashboardAnnouncementsResponseDto })
  listAnnouncements(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardAnnouncementsQueryDto,
  ): Promise<DashboardAnnouncementsResponseDto> {
    return this.dashboardAnnouncementsService
      .listAnnouncements(request.user, query)
      .then((items) => ({ items }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one announcement by id' })
  @ApiOkResponse({ type: DashboardAnnouncementItemDto })
  getAnnouncement(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardAnnouncementItemDto> {
    return this.dashboardAnnouncementsService.getAnnouncement(request.user, id);
  }
}
