import { Controller, Get, Query, Req } from '@nestjs/common';
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
import {
  TeacherAssignmentsQueryDto,
  TeacherAssignmentsResponseDto,
  TeacherScheduleResponseDto,
} from './dto/teacher-schedule.dto';
import { TeacherScheduleService } from './teacher-schedule.service';

@ApiTags('Teacher Schedule v1')
@ApiBearerAuth()
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherScheduleController {
  constructor(private readonly teacherScheduleService: TeacherScheduleService) {}

  @Get('me/schedule')
  @ApiOperation({
    summary: 'Get the logged-in teacher weekly timetable',
    description:
      'Returns school days with period entries for courses this teacher teaches.',
  })
  @ApiOkResponse({ type: TeacherScheduleResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getSchedule(
    @Req() request: Request & { user: AuthenticatedTeacher },
  ): Promise<TeacherScheduleResponseDto> {
    return this.teacherScheduleService.getSchedule(request.user);
  }

  @Get('me/assignments')
  @ApiOperation({
    summary: 'List teaching assignments',
    description:
      'Paginated Teach rows for the current year. classId is the section id used by the teacher app.',
  })
  @ApiOkResponse({ type: TeacherAssignmentsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listAssignments(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Query() query: TeacherAssignmentsQueryDto,
  ): Promise<TeacherAssignmentsResponseDto> {
    return this.teacherScheduleService.listAssignments(request.user, query);
  }
}
