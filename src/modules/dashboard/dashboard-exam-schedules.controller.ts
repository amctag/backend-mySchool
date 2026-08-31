import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
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
import { DashboardExamScheduleDetailResponseDto } from './dto/dashboard-exam-schedule-detail-response.dto';
import { DashboardExamSchedulesQueryDto } from './dto/dashboard-exam-schedules-query.dto';
import { DashboardExamSchedulesResponseDto } from './dto/dashboard-exam-schedules-response.dto';
import { DashboardGradeTypesResponseDto } from './dto/dashboard-grade-types-response.dto';
import { SaveDashboardExamScheduleDto } from './dto/save-dashboard-exam-schedule.dto';
import { DashboardExamSchedulesService } from './dashboard-exam-schedules.service';

@ApiTags('Dashboard Exam Schedules v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/exam-schedules', version: '1' })
export class DashboardExamSchedulesController {
  constructor(
    private readonly dashboardExamSchedulesService: DashboardExamSchedulesService,
  ) {}

  @Get('grade-types')
  @ApiOperation({ summary: 'List grade types for exam schedules' })
  @ApiOkResponse({ type: DashboardGradeTypesResponseDto })
  listGradeTypes(
    @Req() request: Request & { user: AuthenticatedSchool },
  ): Promise<DashboardGradeTypesResponseDto> {
    return this.dashboardExamSchedulesService.listGradeTypes(request.user);
  }

  @Get()
  @ApiOperation({ summary: 'List exam schedules for this school' })
  @ApiOkResponse({ type: DashboardExamSchedulesResponseDto })
  listExamSchedules(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardExamSchedulesQueryDto,
  ): Promise<DashboardExamSchedulesResponseDto> {
    return this.dashboardExamSchedulesService.listExamSchedules(
      request.user,
      query,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one exam schedule' })
  @ApiOkResponse({ type: DashboardExamScheduleDetailResponseDto })
  getExamSchedule(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardExamScheduleDetailResponseDto> {
    return this.dashboardExamSchedulesService.getExamSchedule(request.user, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an exam schedule' })
  @ApiCreatedResponse({ type: DashboardExamScheduleDetailResponseDto })
  createExamSchedule(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() body: SaveDashboardExamScheduleDto,
  ): Promise<DashboardExamScheduleDetailResponseDto> {
    return this.dashboardExamSchedulesService.createExamSchedule(
      request.user,
      body,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an exam schedule' })
  @ApiOkResponse({ type: DashboardExamScheduleDetailResponseDto })
  updateExamSchedule(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SaveDashboardExamScheduleDto,
  ): Promise<DashboardExamScheduleDetailResponseDto> {
    return this.dashboardExamSchedulesService.updateExamSchedule(
      request.user,
      id,
      body,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an exam schedule' })
  deleteExamSchedule(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.dashboardExamSchedulesService.deleteExamSchedule(
      request.user,
      id,
    );
  }
}
