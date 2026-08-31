import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateDashboardAnnouncementDto } from './dto/create-dashboard-announcement.dto';
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
  @ApiOperation({
    summary: 'List dashboard announcements',
    description:
      'Returns all announcements created by person id 1 for this school admin.',
  })
  @ApiOkResponse({ type: DashboardAnnouncementsResponseDto })
  listAnnouncements(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardAnnouncementsQueryDto,
  ): Promise<DashboardAnnouncementsResponseDto> {
    return this.dashboardAnnouncementsService.listAnnouncements(
      request.user,
      query,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Create a dashboard announcement',
    description:
      'Creates an announcement as person id 1 (created by). School admin only.',
  })
  @ApiCreatedResponse({ type: DashboardAnnouncementItemDto })
  createAnnouncement(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardAnnouncementDto,
  ): Promise<DashboardAnnouncementItemDto> {
    return this.dashboardAnnouncementsService.createAnnouncement(
      request.user,
      dto,
    );
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
