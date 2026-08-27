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
import { CreateDashboardParentDto } from './dto/create-dashboard-parent.dto';
import { DashboardParentDetailDto } from './dto/dashboard-parent-detail.dto';
import { DashboardParentsQueryDto } from './dto/dashboard-parents-query.dto';
import { DashboardParentsResponseDto } from './dto/dashboard-parents-response.dto';
import { UpdateDashboardParentDto } from './dto/update-dashboard-parent.dto';
import { DashboardParentsService } from './dashboard-parents.service';

@ApiTags('Dashboard Parents v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/parents', version: '1' })
export class DashboardParentsController {
  constructor(
    private readonly dashboardParentsService: DashboardParentsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List school parents with pagination, name/id filters, and search',
  })
  @ApiOkResponse({ type: DashboardParentsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid school session' })
  @ApiForbiddenResponse({ description: 'Not a school admin' })
  listParents(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardParentsQueryDto,
  ): Promise<DashboardParentsResponseDto> {
    return this.dashboardParentsService.listParents(request.user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a parent for this school' })
  @ApiCreatedResponse({ type: DashboardParentDetailDto })
  createParent(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardParentDto,
  ): Promise<DashboardParentDetailDto> {
    return this.dashboardParentsService.createParent(request.user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a parent for edit' })
  @ApiOkResponse({ type: DashboardParentDetailDto })
  getParent(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardParentDetailDto> {
    return this.dashboardParentsService.getParent(request.user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a parent' })
  @ApiOkResponse({ type: DashboardParentDetailDto })
  updateParent(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardParentDto,
  ): Promise<DashboardParentDetailDto> {
    return this.dashboardParentsService.updateParent(request.user, id, dto);
  }
}
