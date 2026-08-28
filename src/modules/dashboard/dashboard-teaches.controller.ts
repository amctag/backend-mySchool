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
import { CreateDashboardTeachDto } from './dto/create-dashboard-teach.dto';
import { DashboardTeachesQueryDto } from './dto/dashboard-teaches-query.dto';
import {
  DashboardTeachItemDto,
  DashboardTeachesResponseDto,
} from './dto/dashboard-teaches-response.dto';
import { UpdateDashboardTeachDto } from './dto/update-dashboard-teach.dto';
import { DashboardTeachesService } from './dashboard-teaches.service';

@ApiTags('Dashboard Teaches v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/teaches', version: '1' })
export class DashboardTeachesController {
  constructor(
    private readonly dashboardTeachesService: DashboardTeachesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List teacher-to-section-course assignments' })
  @ApiOkResponse({ type: DashboardTeachesResponseDto })
  listTeaches(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardTeachesQueryDto,
  ): Promise<DashboardTeachesResponseDto> {
    return this.dashboardTeachesService.listTeaches(request.user, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Assign a teacher to a section and course for a year',
  })
  @ApiCreatedResponse({ type: DashboardTeachItemDto })
  createTeach(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardTeachDto,
  ): Promise<DashboardTeachItemDto> {
    return this.dashboardTeachesService.createTeach(request.user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a teach assignment' })
  @ApiOkResponse({ type: DashboardTeachItemDto })
  getTeach(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardTeachItemDto> {
    return this.dashboardTeachesService.getTeach(request.user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a teach assignment' })
  @ApiOkResponse({ type: DashboardTeachItemDto })
  updateTeach(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardTeachDto,
  ): Promise<DashboardTeachItemDto> {
    return this.dashboardTeachesService.updateTeach(request.user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a teach assignment' })
  deleteTeach(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.dashboardTeachesService.deleteTeach(request.user, id);
  }
}
