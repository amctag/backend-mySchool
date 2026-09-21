import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
  CreateTeacherAnnouncementDto,
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
      'Published announcements targeted to teachers. Optional classId and sectionId filter on the server. School-wide items are excluded when a class or section is selected.',
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

  @Post('me/announcements')
  @ApiOperation({
    summary: 'Create an announcement for a supervised class',
    description:
      'Supervisors only. Audience is parent or teacher, scoped to a supervised section.',
  })
  @ApiCreatedResponse({ type: TeacherAnnouncementItemDto })
  @ApiForbiddenResponse({ description: 'Not a supervisor of this class' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  createAnnouncement(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Body() dto: CreateTeacherAnnouncementDto,
  ): Promise<TeacherAnnouncementItemDto> {
    return this.teacherAnnouncementsService.createAnnouncement(
      request.user,
      dto,
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
