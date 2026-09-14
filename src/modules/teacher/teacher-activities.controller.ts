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
  TeacherActivitiesQueryDto,
  TeacherActivitiesResponseDto,
  TeacherActivityItemDto,
} from './dto/teacher-media.dto';
import { TeacherActivitiesService } from './teacher-activities.service';

@ApiTags('Teacher Activities v1')
@ApiBearerAuth()
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherActivitiesController {
  constructor(
    private readonly teacherActivitiesService: TeacherActivitiesService,
  ) {}

  @Get('me/activities')
  @ApiOperation({
    summary: 'List activities for me',
    description:
      'School-wide activities and activities for academic years I teach.',
  })
  @ApiOkResponse({ type: TeacherActivitiesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listActivities(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Query() query: TeacherActivitiesQueryDto,
  ): Promise<TeacherActivitiesResponseDto> {
    return this.teacherActivitiesService.listActivities(request.user, query);
  }

  @Get('me/activities/:activityId')
  @ApiOperation({ summary: 'Get one activity for me' })
  @ApiOkResponse({ type: TeacherActivityItemDto })
  @ApiNotFoundResponse({ description: 'Activity not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getActivity(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('activityId', ParseIntPipe) activityId: number,
  ): Promise<TeacherActivityItemDto> {
    return this.teacherActivitiesService.getActivity(request.user, activityId);
  }
}
