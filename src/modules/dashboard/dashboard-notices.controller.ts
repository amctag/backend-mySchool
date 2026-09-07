import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
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
import { CreateDashboardNoticeDto } from './dto/create-dashboard-notice.dto';
import { DashboardNoticesQueryDto } from './dto/dashboard-notices-query.dto';
import {
  DashboardNoticeItemDto,
  DashboardNoticesResponseDto,
} from './dto/dashboard-notices-response.dto';
import { DashboardNoticesService } from './dashboard-notices.service';

@ApiTags('Dashboard Notices v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/notices', version: '1' })
export class DashboardNoticesController {
  constructor(
    private readonly dashboardNoticesService: DashboardNoticesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List dashboard notices',
    description:
      'Returns notices for this school. Empty section and student targets means all school, same as announcements.',
  })
  @ApiOkResponse({ type: DashboardNoticesResponseDto })
  listNotices(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardNoticesQueryDto,
  ): Promise<DashboardNoticesResponseDto> {
    return this.dashboardNoticesService.listNotices(request.user, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a dashboard notice',
    description:
      'Creates a notice as person id 1. Optional section (notice_sections) and students (notice_students). Omit both for all school.',
  })
  @ApiCreatedResponse({ type: DashboardNoticeItemDto })
  createNotice(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardNoticeDto,
  ): Promise<DashboardNoticeItemDto> {
    return this.dashboardNoticesService.createNotice(request.user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one notice by id' })
  @ApiOkResponse({ type: DashboardNoticeItemDto })
  getNotice(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardNoticeItemDto> {
    return this.dashboardNoticesService.getNotice(request.user, id);
  }
}
