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
  ApiBadRequestResponse,
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
  TeacherActivitiesQueryDto,
  TeacherActivitiesResponseDto,
  TeacherActivityItemDto,
  UpsertTeacherActivityDto,
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
    summary: 'List activities for my classes',
    description:
      'Section-scoped activities for classes I teach, plus school/year-wide activities.',
  })
  @ApiOkResponse({ type: TeacherActivitiesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listActivities(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Query() query: TeacherActivitiesQueryDto,
  ): Promise<TeacherActivitiesResponseDto> {
    return this.teacherActivitiesService.listActivities(request.user, query);
  }

  @Post('me/activities')
  @ApiOperation({
    summary: 'Create an activity for a class',
    description:
      'Creates an activity for one teaching assignment (class section + course). Parents of children in that section are notified.',
  })
  @ApiCreatedResponse({ type: TeacherActivityItemDto })
  @ApiBadRequestResponse({
    description: 'Validation failed or classId does not match the assignment',
  })
  @ApiForbiddenResponse({ description: 'Teacher is not assigned to this class' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  createActivity(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Body() dto: UpsertTeacherActivityDto,
  ): Promise<TeacherActivityItemDto> {
    return this.teacherActivitiesService.createActivity(request.user, dto);
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
