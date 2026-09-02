import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardScheduleGeneratorQueryDto } from './dto/dashboard-schedule-generator-query.dto';
import { DashboardScheduleGeneratorResponseDto } from './dto/dashboard-schedule-generator-response.dto';
import { DashboardScheduleGeneratorService } from './dashboard-schedule-generator.service';

@ApiTags('Dashboard Schedule Generator v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/schedule-generator', version: '1' })
export class DashboardScheduleGeneratorController {
  constructor(
    private readonly dashboardScheduleGeneratorService: DashboardScheduleGeneratorService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Get teach assignments for schedule generation (year id 3). Query: schoolId, optional sectionId.',
  })
  @ApiOkResponse({ type: DashboardScheduleGeneratorResponseDto })
  getScheduleGeneratorData(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardScheduleGeneratorQueryDto,
  ): Promise<DashboardScheduleGeneratorResponseDto> {
    return this.dashboardScheduleGeneratorService.getScheduleGeneratorData(
      request.user,
      query,
    );
  }
}
