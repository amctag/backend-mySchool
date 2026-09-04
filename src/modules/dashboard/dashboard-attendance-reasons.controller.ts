import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
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
import { CreateDashboardAttendanceReasonDto } from './dto/create-dashboard-attendance-reason.dto';
import { DashboardAttendanceReasonItemDto } from './dto/dashboard-attendance-reason-item.dto';
import { UpdateDashboardAttendanceReasonDto } from './dto/update-dashboard-attendance-reason.dto';
import { DashboardAttendanceReasonsService } from './dashboard-attendance-reasons.service';

@ApiTags('Dashboard Attendance Reasons v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/attendance-reasons', version: '1' })
export class DashboardAttendanceReasonsController {
  constructor(
    private readonly dashboardAttendanceReasonsService: DashboardAttendanceReasonsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List attendance reasons' })
  @ApiOkResponse({ type: [DashboardAttendanceReasonItemDto] })
  listReasons(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query('activeOnly') activeOnly?: string,
  ): Promise<DashboardAttendanceReasonItemDto[]> {
    return this.dashboardAttendanceReasonsService.listReasons(
      request.user,
      activeOnly === '1' || activeOnly === 'true',
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create an attendance reason' })
  @ApiCreatedResponse({ type: DashboardAttendanceReasonItemDto })
  createReason(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardAttendanceReasonDto,
  ): Promise<DashboardAttendanceReasonItemDto> {
    return this.dashboardAttendanceReasonsService.createReason(
      request.user,
      dto,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one attendance reason' })
  @ApiOkResponse({ type: DashboardAttendanceReasonItemDto })
  getReason(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardAttendanceReasonItemDto> {
    return this.dashboardAttendanceReasonsService.getReason(request.user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an attendance reason' })
  @ApiOkResponse({ type: DashboardAttendanceReasonItemDto })
  updateReason(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardAttendanceReasonDto,
  ): Promise<DashboardAttendanceReasonItemDto> {
    return this.dashboardAttendanceReasonsService.updateReason(
      request.user,
      id,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete an attendance reason' })
  async deleteReason(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.dashboardAttendanceReasonsService.deleteReason(
      request.user,
      id,
    );
  }
}
