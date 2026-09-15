import { Controller, Get, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedParent } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParentNotificationsResponseDto } from './dto/parent-notifications-response.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Notifications v1')
@Roles('parent')
@Controller({ path: 'parent', version: '1' })
export class ParentNotificationController {
  constructor(private readonly parentService: ParentService) {}

  @Get('me/notifications')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List saved push notifications for the logged-in parent',
    description:
      'Returns Firebase push notifications that were saved for this parent person, newest first.',
  })
  @ApiOkResponse({ type: ParentNotificationsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getNotifications(
    @Req() request: Request & { user: AuthenticatedParent },
  ): Promise<ParentNotificationsResponseDto> {
    return this.parentService.getNotifications(request.user);
  }
}
