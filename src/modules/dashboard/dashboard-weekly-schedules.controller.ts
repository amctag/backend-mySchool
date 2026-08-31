import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardWeeklyScheduleGridQueryDto } from './dto/dashboard-weekly-schedules-grid-query.dto';
import { DashboardWeeklyScheduleGridResponseDto } from './dto/dashboard-weekly-schedules-grid-response.dto';
import { DashboardWeeklySchedulesQueryDto } from './dto/dashboard-weekly-schedules-query.dto';
import { DashboardWeeklySchedulesResponseDto } from './dto/dashboard-weekly-schedules-response.dto';
import { DashboardWeeklySchedulesService } from './dashboard-weekly-schedules.service';

@ApiTags('Dashboard Weekly Schedules v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/weekly-schedules', version: '1' })
export class DashboardWeeklySchedulesController {
  constructor(
    private readonly dashboardWeeklySchedulesService: DashboardWeeklySchedulesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List weekly schedule entries for this school' })
  @ApiOkResponse({ type: DashboardWeeklySchedulesResponseDto })
  listWeeklySchedules(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardWeeklySchedulesQueryDto,
  ): Promise<DashboardWeeklySchedulesResponseDto> {
    return this.dashboardWeeklySchedulesService.listWeeklySchedules(
      request.user,
      query,
    );
  }

  @Get('grid')
  @ApiOperation({ summary: 'Get weekly schedule grid for one section' })
  @ApiOkResponse({ type: DashboardWeeklyScheduleGridResponseDto })
  getWeeklyScheduleGrid(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardWeeklyScheduleGridQueryDto,
  ): Promise<DashboardWeeklyScheduleGridResponseDto> {
    return this.dashboardWeeklySchedulesService.getWeeklyScheduleGrid(
      request.user,
      query,
    );
  }
}
