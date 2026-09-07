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
import { CreateDashboardActivityDto } from './dto/create-dashboard-activity.dto';
import { DashboardActivitiesQueryDto } from './dto/dashboard-activities-query.dto';
import {
  DashboardActivityItemDto,
  DashboardActivitiesResponseDto,
} from './dto/dashboard-activities-response.dto';
import { DashboardActivitiesService } from './dashboard-activities.service';

@ApiTags('Dashboard Activities v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/activities', version: '1' })
export class DashboardActivitiesController {
  constructor(
    private readonly dashboardActivitiesService: DashboardActivitiesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List dashboard activities',
    description:
      'Returns activities for this school. yearId null means all school.',
  })
  @ApiOkResponse({ type: DashboardActivitiesResponseDto })
  listActivities(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardActivitiesQueryDto,
  ): Promise<DashboardActivitiesResponseDto> {
    return this.dashboardActivitiesService.listActivities(request.user, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a dashboard activity',
    description:
      'Creates an activity as person id 1. Optional yearId scopes it; omit for all school. Sends FCM to matching parents.',
  })
  @ApiCreatedResponse({ type: DashboardActivityItemDto })
  createActivity(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardActivityDto,
  ): Promise<DashboardActivityItemDto> {
    return this.dashboardActivitiesService.createActivity(request.user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one activity by id' })
  @ApiOkResponse({ type: DashboardActivityItemDto })
  getActivity(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardActivityItemDto> {
    return this.dashboardActivitiesService.getActivity(request.user, id);
  }
}
