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
import { CreateDashboardSessionDto } from './dto/create-dashboard-session.dto';
import { DashboardSessionItemDto } from './dto/dashboard-session-item.dto';
import { UpdateDashboardSessionDto } from './dto/update-dashboard-session.dto';
import { DashboardSessionsService } from './dashboard-sessions.service';

@ApiTags('Dashboard Sessions v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/sessions', version: '1' })
export class DashboardSessionsController {
  constructor(
    private readonly dashboardSessionsService: DashboardSessionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List timetable sessions for this school' })
  @ApiOkResponse({ type: [DashboardSessionItemDto] })
  listSessions(
    @Req() request: Request & { user: AuthenticatedSchool },
  ): Promise<DashboardSessionItemDto[]> {
    return this.dashboardSessionsService.listSessions(request.user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a timetable session' })
  @ApiCreatedResponse({ type: DashboardSessionItemDto })
  createSession(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardSessionDto,
  ): Promise<DashboardSessionItemDto> {
    return this.dashboardSessionsService.createSession(request.user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one session' })
  @ApiOkResponse({ type: DashboardSessionItemDto })
  getSession(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardSessionItemDto> {
    return this.dashboardSessionsService.getSession(request.user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a session' })
  @ApiOkResponse({ type: DashboardSessionItemDto })
  updateSession(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardSessionDto,
  ): Promise<DashboardSessionItemDto> {
    return this.dashboardSessionsService.updateSession(
      request.user,
      id,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a session (if unused)' })
  async deleteSession(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.dashboardSessionsService.deleteSession(request.user, id);
  }
}
