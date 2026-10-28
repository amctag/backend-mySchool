import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DirectorScheduleAssignmentsQueryDto,
  DirectorScheduleOptionsQueryDto,
  DirectorScheduleOptionsResponseDto,
  DirectorTeachingAssignmentsResponseDto,
  DirectorWeeklyScheduleQueryDto,
  DirectorWeeklyScheduleResponseDto,
} from './dto/director-schedule.dto';
import { DirectorScheduleService } from './director-schedule.service';

@ApiTags('Director Schedule v1')
@ApiBearerAuth()
@Roles('director')
@Controller({ path: 'director', version: '1' })
export class DirectorScheduleController {
  constructor(private readonly directorScheduleService: DirectorScheduleService) {}

  @Get('me/schedule/options')
  @ApiOperation({
    summary: 'List schedule selectors for the director\'s school',
    description:
      'Classes with their sections for the active academic year, plus every teacher that belongs to the director\'s school.',
  })
  @ApiOkResponse({ type: DirectorScheduleOptionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getOptions(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Query() query: DirectorScheduleOptionsQueryDto,
  ): Promise<DirectorScheduleOptionsResponseDto> {
    return this.directorScheduleService.getOptions(request.user, query);
  }

  @Get('me/schedule')
  @ApiOperation({
    summary: 'Get a weekly timetable as a director',
    description:
      'Returns the weekly timetable of one section (mode=class) or one teacher (mode=teacher) in the director\'s school and active academic year. Weeks are ordered by the school day position and entries by session position.',
  })
  @ApiOkResponse({ type: DirectorWeeklyScheduleResponseDto })
  @ApiBadRequestResponse({
    description: 'Missing sectionId (class mode) or teacherId (teacher mode)',
  })
  @ApiNotFoundResponse({
    description: 'Section, teacher, or academic year not found in this school',
  })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getWeeklySchedule(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Query() query: DirectorWeeklyScheduleQueryDto,
  ): Promise<DirectorWeeklyScheduleResponseDto> {
    return this.directorScheduleService.getWeeklySchedule(request.user, query);
  }

  @Get('me/assignments')
  @ApiOperation({
    summary: 'List teaching assignments in the director\'s school',
    description:
      'Teach rows for the active academic year in the director\'s assigned school.',
  })
  @ApiOkResponse({ type: DirectorTeachingAssignmentsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listAssignments(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Query() query: DirectorScheduleAssignmentsQueryDto,
  ): Promise<DirectorTeachingAssignmentsResponseDto> {
    return this.directorScheduleService.listAssignments(request.user, query);
  }
}
