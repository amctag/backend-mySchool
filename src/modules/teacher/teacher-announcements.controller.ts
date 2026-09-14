import { Controller, Get, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  TeacherAnnouncementItemDto,
  TeacherAnnouncementsQueryDto,
  TeacherAnnouncementsResponseDto,
} from './dto/teacher-announcements.dto';
import { TeacherAnnouncementsService } from './teacher-announcements.service';

@ApiTags('Teacher Announcements v1')
@ApiBearerAuth()
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherAnnouncementsController {
  constructor(
    private readonly teacherAnnouncementsService: TeacherAnnouncementsService,
  ) {}

  @Get('me/announcements')
  @ApiOperation({
    summary: 'List announcements for me',
    description:
      'Published announcements targeted to teachers. Includes school-wide items and items for classes I teach.',
  })
  @ApiOkResponse({ type: TeacherAnnouncementsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listAnnouncements(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Query() query: TeacherAnnouncementsQueryDto,
  ): Promise<TeacherAnnouncementsResponseDto> {
    return this.teacherAnnouncementsService.listAnnouncements(
      request.user,
      query,
    );
  }

  @Get('me/announcements/:announcementId')
  @ApiOperation({ summary: 'Get one announcement for me' })
  @ApiOkResponse({ type: TeacherAnnouncementItemDto })
  @ApiNotFoundResponse({ description: 'Announcement not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getAnnouncement(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('announcementId', ParseIntPipe) announcementId: number,
  ): Promise<TeacherAnnouncementItemDto> {
    return this.teacherAnnouncementsService.getAnnouncement(
      request.user,
      announcementId,
    );
  }
}
