import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DashboardOverviewQueryDto,
  DashboardOverviewResponseDto,
} from './dto/dashboard-overview-response.dto';
import { DashboardOverviewService } from './dashboard-overview.service';

@ApiTags('Dashboard Overview v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/overview', version: '1' })
export class DashboardOverviewController {
  constructor(
    private readonly dashboardOverviewService: DashboardOverviewService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'School dashboard overview stats and recent lists (year-filtered on backend)',
  })
  @ApiOkResponse({ type: DashboardOverviewResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid school session' })
  @ApiForbiddenResponse({ description: 'Not a school admin' })
  getOverview(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardOverviewQueryDto,
  ): Promise<DashboardOverviewResponseDto> {
    return this.dashboardOverviewService.getOverview(request.user, query);
  }
}
