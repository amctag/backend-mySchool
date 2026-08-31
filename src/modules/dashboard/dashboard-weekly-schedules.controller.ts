import { Controller, Delete, Get, Post, Body, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
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
import { DashboardWeeklySchedulesGridsQueryDto } from './dto/dashboard-weekly-schedules-grids-query.dto';
import { DashboardWeeklySchedulesGridsResponseDto } from './dto/dashboard-weekly-schedules-grids-response.dto';
import { DashboardWeeklyScheduleGridQueryDto } from './dto/dashboard-weekly-schedules-grid-query.dto';
import { DashboardWeeklyScheduleGridResponseDto } from './dto/dashboard-weekly-schedules-grid-response.dto';
import { DashboardWeeklySchedulesQueryDto } from './dto/dashboard-weekly-schedules-query.dto';
import { DashboardWeeklySchedulesResponseDto } from './dto/dashboard-weekly-schedules-response.dto';
import { SaveDashboardWeeklyScheduleDto } from './dto/save-dashboard-weekly-schedule.dto';
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
  @ApiOperation({ summary: 'List weekly schedules for this school' })
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

  @Get('grids')
  @ApiOperation({ summary: 'List weekly schedule grids for this school' })
  @ApiOkResponse({ type: DashboardWeeklySchedulesGridsResponseDto })
  listWeeklyScheduleGrids(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardWeeklySchedulesGridsQueryDto,
  ): Promise<DashboardWeeklySchedulesGridsResponseDto> {
    return this.dashboardWeeklySchedulesService.listWeeklyScheduleGrids(
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

  @Post()
  @ApiOperation({ summary: 'Create or update weekly schedule for one section' })
  @ApiCreatedResponse({ type: DashboardWeeklyScheduleGridResponseDto })
  saveWeeklySchedule(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() body: SaveDashboardWeeklyScheduleDto,
  ): Promise<DashboardWeeklyScheduleGridResponseDto> {
    return this.dashboardWeeklySchedulesService.saveWeeklySchedule(
      request.user,
      body,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a weekly schedule' })
  deleteWeeklySchedule(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.dashboardWeeklySchedulesService.deleteWeeklySchedule(
      request.user,
      id,
    );
  }
}
