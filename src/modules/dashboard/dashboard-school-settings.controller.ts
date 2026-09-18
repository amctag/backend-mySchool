import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
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
  DashboardSchoolSettingsDto,
  UpdateDashboardSchoolSettingsDto,
} from './dto/dashboard-school-settings.dto';
import { DashboardSchoolSettingsService } from './dashboard-school-settings.service';

@ApiTags('Dashboard School Settings v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/settings', version: '1' })
export class DashboardSchoolSettingsController {
  constructor(
    private readonly dashboardSchoolSettingsService: DashboardSchoolSettingsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get school settings' })
  @ApiOkResponse({ type: DashboardSchoolSettingsDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid school session' })
  @ApiForbiddenResponse({ description: 'Not a school admin' })
  getSettings(
    @Req() request: Request & { user: AuthenticatedSchool },
  ): Promise<DashboardSchoolSettingsDto> {
    return this.dashboardSchoolSettingsService.getSettings(request.user);
  }

  @Patch()
  @ApiOperation({ summary: 'Update school settings' })
  @ApiOkResponse({ type: DashboardSchoolSettingsDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid school session' })
  @ApiForbiddenResponse({ description: 'Not a school admin' })
  updateSettings(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: UpdateDashboardSchoolSettingsDto,
  ): Promise<DashboardSchoolSettingsDto> {
    return this.dashboardSchoolSettingsService.updateSettings(
      request.user,
      dto,
    );
  }
}
