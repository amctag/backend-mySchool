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
import { CreateDashboardAgendaDto } from './dto/create-dashboard-agenda.dto';
import { DashboardAgendasQueryDto } from './dto/dashboard-agendas-query.dto';
import {
  DashboardAgendaItemDto,
  DashboardAgendasResponseDto,
} from './dto/dashboard-agendas-response.dto';
import { UpdateDashboardAgendaDto } from './dto/update-dashboard-agenda.dto';
import { DashboardAgendasService } from './dashboard-agendas.service';

@ApiTags('Dashboard Agendas v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/agendas', version: '1' })
export class DashboardAgendasController {
  constructor(
    private readonly dashboardAgendasService: DashboardAgendasService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List agendas for this school' })
  @ApiOkResponse({ type: DashboardAgendasResponseDto })
  listAgendas(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardAgendasQueryDto,
  ): Promise<DashboardAgendasResponseDto> {
    return this.dashboardAgendasService.listAgendas(request.user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create an agenda' })
  @ApiCreatedResponse({ type: DashboardAgendaItemDto })
  createAgenda(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardAgendaDto,
  ): Promise<DashboardAgendaItemDto> {
    return this.dashboardAgendasService.createAgenda(request.user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one agenda' })
  @ApiOkResponse({ type: DashboardAgendaItemDto })
  getAgenda(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardAgendaItemDto> {
    return this.dashboardAgendasService.getAgenda(request.user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an agenda' })
  @ApiOkResponse({ type: DashboardAgendaItemDto })
  updateAgenda(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardAgendaDto,
  ): Promise<DashboardAgendaItemDto> {
    return this.dashboardAgendasService.updateAgenda(request.user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete an agenda' })
  async deleteAgenda(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.dashboardAgendasService.deleteAgenda(request.user, id);
  }
}
