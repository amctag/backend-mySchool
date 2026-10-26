import {
  Body,
  Controller,
  Delete,
  Post,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  TeacherActivitiesQueryDto,
  TeacherActivityItemDto,
  TeacherActivitiesResponseDto,
  UpsertTeacherActivityDto,
} from './dto/director-activities.dto';
import { DirectorActivitiesService } from './director-activities.service';

@ApiTags('Director Activities v1')
@ApiBearerAuth()
@Roles('director')
@Controller({ path: 'director', version: '1' })
export class DirectorActivitiesController {
  constructor(private readonly directorActivitiesService: DirectorActivitiesService) {}

  @Get('me/activities')
  @ApiOperation({
    summary: 'List activities for director\'s school',
    description:
      'Returns activities for the director\'s assigned school, filterable by date.',
  })
  @ApiOkResponse({ type: TeacherActivitiesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listActivities(
    @Req() request: { user: AuthenticatedDirector },
    @Query() query: TeacherActivitiesQueryDto,
  ): Promise<TeacherActivitiesResponseDto> {
    return this.directorActivitiesService.listActivities(request.user, query);
  }

  @Get('me/activities/:id')
  @ApiOperation({
    summary: 'Get activity by id for director\'s school',
    description: 'Returns a specific activity by ID.',
  })
  @ApiOkResponse({ type: TeacherActivityItemDto })
  @ApiForbiddenResponse({ description: 'Activity not in director\'s school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getActivity(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') activityId: number,
  ): Promise<TeacherActivityItemDto> {
    return this.directorActivitiesService.getActivity(request.user, activityId);
  }

  @Post('me/activities')
  @ApiOperation({
    summary: 'Create activity for director\'s school',
    description: 'Creates a new activity in the director\'s assigned school.',
  })
  @ApiCreatedResponse({ type: TeacherActivityItemDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: 'Director cannot create activities' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  createActivity(
    @Req() request: { user: AuthenticatedDirector },
    @Body() dto: UpsertTeacherActivityDto,
  ): Promise<TeacherActivityItemDto> {
    return this.directorActivitiesService.createActivity(request.user, dto);
  }

  @Patch('me/activities/:id')
  @ApiOperation({
    summary: 'Update activity for director\'s school',
    description: 'Updates an existing activity in the director\'s school.',
  })
  @ApiOkResponse({ type: TeacherActivityItemDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: 'Activity not in director\'s school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  updateActivity(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') activityId: number,
    @Body() dto: UpsertTeacherActivityDto,
  ): Promise<TeacherActivityItemDto> {
    return this.directorActivitiesService.updateActivity(request.user, activityId, dto);
  }

  @Delete('me/activities/:id')
  @ApiOperation({
    summary: 'Delete activity for director\'s school',
    description: 'Deletes an activity from the director\'s school.',
  })
  @ApiOkResponse({ type: Boolean })
  @ApiForbiddenResponse({ description: 'Activity not in director\'s school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  deleteActivity(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') activityId: number,
  ): Promise<boolean> {
    return this.directorActivitiesService.deleteActivity(request.user, activityId);
  }
}