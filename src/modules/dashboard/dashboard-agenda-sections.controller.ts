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
import { CreateDashboardAgendaSectionDto } from './dto/create-dashboard-agenda-section.dto';
import { DashboardAgendaSectionsQueryDto } from './dto/dashboard-agenda-sections-query.dto';
import {
  DashboardAgendaSectionRowDto,
  DashboardAgendaSectionsResponseDto,
} from './dto/dashboard-agenda-sections-response.dto';
import { UpdateDashboardAgendaSectionDto } from './dto/update-dashboard-agenda-section.dto';
import { DashboardAgendaSectionsService } from './dashboard-agenda-sections.service';

@ApiTags('Dashboard Agenda Sections v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/agenda-sections', version: '1' })
export class DashboardAgendaSectionsController {
  constructor(
    private readonly dashboardAgendaSectionsService: DashboardAgendaSectionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List agenda section assignments' })
  @ApiOkResponse({ type: DashboardAgendaSectionsResponseDto })
  listAgendaSections(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardAgendaSectionsQueryDto,
  ): Promise<DashboardAgendaSectionsResponseDto> {
    return this.dashboardAgendaSectionsService.listAgendaSections(
      request.user,
      query,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Assign an agenda to a section' })
  @ApiCreatedResponse({ type: DashboardAgendaSectionRowDto })
  createAgendaSection(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardAgendaSectionDto,
  ): Promise<DashboardAgendaSectionRowDto> {
    return this.dashboardAgendaSectionsService.createAgendaSection(
      request.user,
      dto,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one agenda section assignment' })
  @ApiOkResponse({ type: DashboardAgendaSectionRowDto })
  getAgendaSection(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardAgendaSectionRowDto> {
    return this.dashboardAgendaSectionsService.getAgendaSection(
      request.user,
      id,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an agenda section assignment' })
  @ApiOkResponse({ type: DashboardAgendaSectionRowDto })
  updateAgendaSection(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardAgendaSectionDto,
  ): Promise<DashboardAgendaSectionRowDto> {
    return this.dashboardAgendaSectionsService.updateAgendaSection(
      request.user,
      id,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete an agenda section assignment' })
  async deleteAgendaSection(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.dashboardAgendaSectionsService.deleteAgendaSection(
      request.user,
      id,
    );
  }
}
