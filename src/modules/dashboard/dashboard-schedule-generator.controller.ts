import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { DashboardScheduleGeneratorQueryDto } from './dto/dashboard-schedule-generator-query.dto';
import { DashboardScheduleGeneratorResponseDto } from './dto/dashboard-schedule-generator-response.dto';
import { DashboardScheduleGeneratorService } from './dashboard-schedule-generator.service';

@ApiTags('Dashboard Schedule Generator v1')
@Controller({ path: 'dashboard/schedule-generator', version: '1' })
export class DashboardScheduleGeneratorController {
  constructor(
    private readonly dashboardScheduleGeneratorService: DashboardScheduleGeneratorService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary:
      'Get teach assignments for schedule generation. Query: schoolId, optional sectionId (class id). Public — no auth.',
  })
  @ApiOkResponse({ type: DashboardScheduleGeneratorResponseDto })
  getScheduleGeneratorData(
    @Query() query: DashboardScheduleGeneratorQueryDto,
  ): Promise<DashboardScheduleGeneratorResponseDto> {
    return this.dashboardScheduleGeneratorService.getScheduleGeneratorData(query);
  }
}
