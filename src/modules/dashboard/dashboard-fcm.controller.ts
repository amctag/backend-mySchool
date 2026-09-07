import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  SendDashboardFcmTestDto,
  SendDashboardFcmTestResponseDto,
} from './dto/send-dashboard-fcm-test.dto';
import { DashboardFcmService } from './dashboard-fcm.service';

@ApiTags('Dashboard FCM v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/fcm', version: '1' })
export class DashboardFcmController {
  constructor(private readonly dashboardFcmService: DashboardFcmService) {}

  @Post('test')
  @ApiOperation({
    summary: 'Send a test FCM notification to a parent',
    description:
      'Looks up the stored fcm_tokens row for the parent personId and sends a test push.',
  })
  @ApiOkResponse({ type: SendDashboardFcmTestResponseDto })
  sendTest(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: SendDashboardFcmTestDto,
  ): Promise<SendDashboardFcmTestResponseDto> {
    return this.dashboardFcmService.sendTest(request.user, dto);
  }
}
