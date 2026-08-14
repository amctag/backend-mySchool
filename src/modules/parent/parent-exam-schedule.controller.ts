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
import { AuthenticatedParent } from '../../auth/interfaces/jwt-payload.interface';
import {
  ParentExamScheduleDetailQueryDto,
  ParentExamSchedulesQueryDto,
} from './dto/parent-exam-schedules-query.dto';
import {
  ParentExamScheduleDetailResponseDto,
  ParentExamSchedulesResponseDto,
} from './dto/parent-exam-schedules-response.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Exam Schedules v1')
@Controller({ path: 'parent', version: '1' })
export class ParentExamScheduleController {
  constructor(private readonly parentService: ParentService) {}

  @Get('me/exam-schedules')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get exam schedules for the parent children',
    description:
      'Returns active exam schedules matching each child class and academic year. ' +
      'Each exam detail includes startTime. Pass studentId to filter by one child.',
  })
  @ApiOkResponse({ type: ParentExamSchedulesResponseDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getExamSchedules(
    @Req() request: Request & { user: AuthenticatedParent },
    @Query() query: ParentExamSchedulesQueryDto,
  ): Promise<ParentExamSchedulesResponseDto> {
    return this.parentService.getExamSchedules(request.user, query.studentId);
  }

  @Get('me/exam-schedules/:scheduleId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get one exam schedule with dates, start times, and course entries',
    description:
      'Returns a single exam schedule when it matches the child class and academic year.',
  })
  @ApiOkResponse({ type: ParentExamScheduleDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Exam schedule or child not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getExamScheduleById(
    @Req() request: Request & { user: AuthenticatedParent },
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @Query() query: ParentExamScheduleDetailQueryDto,
  ): Promise<ParentExamScheduleDetailResponseDto> {
    return this.parentService.getExamScheduleById(
      request.user,
      scheduleId,
      query.studentId,
    );
  }
}
