import { Controller, Get, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { TeacherNotificationsResponseDto } from './dto/teacher-notifications.dto';
import { TeacherNotificationsService } from './teacher-notifications.service';

@ApiTags('Teacher Notifications v1')
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherNotificationsController {
  constructor(
    private readonly teacherNotificationsService: TeacherNotificationsService,
  ) {}

  @Get('me/notifications')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List saved push notifications for the logged-in teacher',
    description:
      'Returns Firebase push notifications that were saved for this teacher person, newest first.',
  })
  @ApiOkResponse({ type: TeacherNotificationsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getNotifications(
    @Req() request: Request & { user: AuthenticatedTeacher },
  ): Promise<TeacherNotificationsResponseDto> {
    return this.teacherNotificationsService.getNotifications(request.user);
  }
}
