import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
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
import { Request } from 'express';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  SaveTeacherAttendanceDto,
  TeacherAttendanceOptionsDto,
  TeacherAttendanceOptionsQueryDto,
  TeacherAttendanceSheetDto,
  TeacherAttendanceSheetQueryDto,
  TeacherAttendancesQueryDto,
  TeacherAttendancesResponseDto,
} from './dto/teacher-attendance.dto';
import { TeacherAttendanceService } from './teacher-attendance.service';

@ApiTags('Teacher Attendances v1')
@ApiBearerAuth()
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherAttendanceController {
  constructor(
    private readonly teacherAttendanceService: TeacherAttendanceService,
  ) {}

  @Get('me/attendances/options')
  @ApiOperation({
    summary: 'List my attendance options',
    description:
      'Classes the logged-in teacher can view or take attendance for. When the school does not record attendance per course, teachers can only view class attendance.',
  })
  @ApiOkResponse({ type: TeacherAttendanceOptionsDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listOptions(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Query() query: TeacherAttendanceOptionsQueryDto,
  ): Promise<TeacherAttendanceOptionsDto> {
    return this.teacherAttendanceService.listOptions(request.user, query.date);
  }

  @Get('me/attendances/sheet')
  @ApiOperation({
    summary: 'Load students for attendance',
    description:
      'Returns the roster and any saved marks for one eligible section (and course when the school records attendance per course).',
  })
  @ApiOkResponse({ type: TeacherAttendanceSheetDto })
  @ApiForbiddenResponse({
    description: 'Teacher cannot take attendance for this class',
  })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getSheet(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Query() query: TeacherAttendanceSheetQueryDto,
  ): Promise<TeacherAttendanceSheetDto> {
    return this.teacherAttendanceService.getSheet(request.user, query);
  }

  @Get('me/attendances')
  @ApiOperation({
    summary: 'List my attendance sheets',
    description:
      'Attendance for classes the logged-in teacher teaches. Teachers may save marks only when the school records attendance per course.',
  })
  @ApiOkResponse({ type: TeacherAttendancesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listAttendances(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Query() query: TeacherAttendancesQueryDto,
  ): Promise<TeacherAttendancesResponseDto> {
    return this.teacherAttendanceService.listAttendances(request.user, query);
  }

  @Post('me/attendances')
  @ApiOperation({
    summary: 'Save attendance for each student',
    description:
      'Creates or replaces the attendance sheet for one assigned course. Not allowed when the school records one class attendance instead of per course.',
  })
  @ApiCreatedResponse({ type: TeacherAttendanceSheetDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({
    description: 'Teacher cannot take attendance for this class',
  })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  saveAttendance(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Body() dto: SaveTeacherAttendanceDto,
  ): Promise<TeacherAttendanceSheetDto> {
    return this.teacherAttendanceService.saveAttendance(request.user, dto);
  }
}
