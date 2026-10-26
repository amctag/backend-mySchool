import {
  Body,
  Controller,
  Get,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DirectorNotificationsQueryDto,
  DirectorNotificationItemDto,
  DirectorNotificationsResponseDto,
} from './dto/director-notifications.dto';
import { DirectorNotificationsService } from './director-notifications.service';

@ApiTags('Director Notifications v1')
@ApiBearerAuth()
@Roles('director')
@Controller({ path: 'director', version: '1' })
export class DirectorNotificationsController {
  constructor(private readonly directorNotificationsService: DirectorNotificationsService) {}

  @Get('me/notifications')
  @ApiOperation({
    summary: 'Get notifications for directors school',
    description: 'Returns notifications for the directors assigned school.',
  })
  @ApiOkResponse({ type: DirectorNotificationsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getNotifications(
    @Req() request: { user: AuthenticatedDirector },
  ): Promise<DirectorNotificationsResponseDto> {
    return this.directorNotificationsService.getNotifications(request.user);
  }
}