import {
  Body,
  Controller,
  Get,
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
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateDashboardDirectorDto } from './dto/create-dashboard-director.dto';
import { DashboardDirectorDetailDto } from './dto/dashboard-director-detail.dto';
import { DashboardDirectorsQueryDto } from './dto/dashboard-directors-query.dto';
import { DashboardDirectorsResponseDto } from './dto/dashboard-directors-response.dto';
import { UpdateDashboardDirectorDto } from './dto/update-dashboard-director.dto';
import {
  DashboardPersonStatusDto,
  UpdateDashboardPersonStatusDto,
} from './dto/dashboard-person-status.dto';
import {
  ResetDashboardPersonPasswordDto,
  ResetDashboardPersonPasswordResponseDto,
} from './dto/reset-dashboard-person-password.dto';
import { DashboardDirectorsService } from './dashboard-directors.service';

@ApiTags('Dashboard Directors v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/directors', version: '1' })
export class DashboardDirectorsController {
  constructor(
    private readonly dashboardDirectorsService: DashboardDirectorsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List school directors with pagination, search, and sort',
  })
  @ApiOkResponse({ type: DashboardDirectorsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid school session' })
  @ApiForbiddenResponse({ description: 'Not a school admin' })
  listDirectors(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardDirectorsQueryDto,
  ): Promise<DashboardDirectorsResponseDto> {
    return this.dashboardDirectorsService.listDirectors(request.user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a director for this school' })
  @ApiCreatedResponse({ type: DashboardDirectorDetailDto })
  createDirector(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardDirectorDto,
  ): Promise<DashboardDirectorDetailDto> {
    return this.dashboardDirectorsService.createDirector(request.user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a director for view or edit' })
  @ApiOkResponse({ type: DashboardDirectorDetailDto })
  getDirector(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardDirectorDetailDto> {
    return this.dashboardDirectorsService.getDirector(request.user, id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Set director active/closed status (person.status)',
  })
  @ApiOkResponse({ type: DashboardPersonStatusDto })
  updateDirectorStatus(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardPersonStatusDto,
  ): Promise<DashboardPersonStatusDto> {
    return this.dashboardDirectorsService.updateDirectorStatus(
      request.user,
      id,
      dto.status,
    );
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Reset director login password' })
  @ApiOkResponse({ type: ResetDashboardPersonPasswordResponseDto })
  resetDirectorPassword(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetDashboardPersonPasswordDto,
  ): Promise<ResetDashboardPersonPasswordResponseDto> {
    return this.dashboardDirectorsService.resetDirectorPassword(
      request.user,
      id,
      dto.newPassword,
      dto.confirmPassword,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a director and the linked person record' })
  @ApiOkResponse({ type: DashboardDirectorDetailDto })
  updateDirector(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardDirectorDto,
  ): Promise<DashboardDirectorDetailDto> {
    return this.dashboardDirectorsService.updateDirector(request.user, id, dto);
  }
}
