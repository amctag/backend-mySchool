import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
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
import { DashboardAttendancesQueryDto } from './dto/dashboard-attendances-query.dto';
import {
  DashboardAttendanceDetailResponseDto,
  DashboardAttendanceSheetDto,
  DashboardAttendancesResponseDto,
} from './dto/dashboard-attendances-response.dto';
import { SaveDashboardAttendanceDto } from './dto/save-dashboard-attendance.dto';
import { DashboardAttendancesService } from './dashboard-attendances.service';

@ApiTags('Dashboard Attendances v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/attendances', version: '1' })
export class DashboardAttendancesController {
  constructor(
    private readonly dashboardAttendancesService: DashboardAttendancesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List attendance records for this school' })
  @ApiOkResponse({ type: DashboardAttendancesResponseDto })
  listAttendances(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardAttendancesQueryDto,
  ): Promise<DashboardAttendancesResponseDto> {
    return this.dashboardAttendancesService.listAttendances(
      request.user,
      query,
    );
  }

  @Get('sheet')
  @ApiOperation({
    summary: 'Get attendance sheet for a section and date (roster + statuses)',
  })
  @ApiOkResponse({ type: DashboardAttendanceSheetDto })
  getAttendanceSheet(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query('sectionId', ParseIntPipe) sectionId: number,
    @Query('date') date: string,
  ): Promise<DashboardAttendanceSheetDto> {
    return this.dashboardAttendancesService.getAttendanceSheet(
      request.user,
      sectionId,
      date,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one attendance record with student details' })
  @ApiOkResponse({ type: DashboardAttendanceDetailResponseDto })
  getAttendance(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardAttendanceDetailResponseDto> {
    return this.dashboardAttendancesService.getAttendance(request.user, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create or replace attendance for a section and date',
  })
  @ApiCreatedResponse({ type: DashboardAttendanceDetailResponseDto })
  saveAttendance(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() body: SaveDashboardAttendanceDto,
  ): Promise<DashboardAttendanceDetailResponseDto> {
    return this.dashboardAttendancesService.saveAttendance(request.user, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete an attendance record' })
  async deleteAttendance(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.dashboardAttendancesService.deleteAttendance(request.user, id);
  }
}
