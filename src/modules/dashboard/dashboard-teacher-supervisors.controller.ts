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
import { CreateDashboardTeacherSupervisorDto } from './dto/create-dashboard-teacher-supervisor.dto';
import { DashboardTeacherSupervisorsQueryDto } from './dto/dashboard-teacher-supervisors-query.dto';
import {
  DashboardTeacherSupervisorCreateResponseDto,
  DashboardTeacherSupervisorItemDto,
  DashboardTeacherSupervisorsResponseDto,
} from './dto/dashboard-teacher-supervisors-response.dto';
import { UpdateDashboardTeacherSupervisorDto } from './dto/update-dashboard-teacher-supervisor.dto';
import { DashboardTeacherSupervisorsService } from './dashboard-teacher-supervisors.service';

@ApiTags('Dashboard Teacher Supervisors v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/teacher-supervisors', version: '1' })
export class DashboardTeacherSupervisorsController {
  constructor(
    private readonly dashboardTeacherSupervisorsService: DashboardTeacherSupervisorsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List teacher class-supervisor assignments' })
  @ApiOkResponse({ type: DashboardTeacherSupervisorsResponseDto })
  listSupervisors(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardTeacherSupervisorsQueryDto,
  ): Promise<DashboardTeacherSupervisorsResponseDto> {
    return this.dashboardTeacherSupervisorsService.listSupervisors(
      request.user,
      query,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Assign a teacher as supervisor of one or more class sections',
  })
  @ApiCreatedResponse({ type: DashboardTeacherSupervisorCreateResponseDto })
  createSupervisor(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardTeacherSupervisorDto,
  ): Promise<DashboardTeacherSupervisorCreateResponseDto> {
    return this.dashboardTeacherSupervisorsService.createSupervisor(
      request.user,
      dto,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a supervisor assignment' })
  @ApiOkResponse({ type: DashboardTeacherSupervisorItemDto })
  getSupervisor(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardTeacherSupervisorItemDto> {
    return this.dashboardTeacherSupervisorsService.getSupervisor(
      request.user,
      id,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a supervisor assignment' })
  @ApiOkResponse({ type: DashboardTeacherSupervisorItemDto })
  updateSupervisor(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardTeacherSupervisorDto,
  ): Promise<DashboardTeacherSupervisorItemDto> {
    return this.dashboardTeacherSupervisorsService.updateSupervisor(
      request.user,
      id,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a supervisor assignment' })
  deleteSupervisor(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.dashboardTeacherSupervisorsService.deleteSupervisor(
      request.user,
      id,
    );
  }
}
