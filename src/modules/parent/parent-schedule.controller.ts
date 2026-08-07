import { Controller, Get, Query, Req } from '@nestjs/common';
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
import { ParentWeeklyScheduleQueryDto } from './dto/parent-weekly-schedule-query.dto';
import { ParentWeeklyScheduleResponseDto } from './dto/parent-weekly-schedule-response.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Schedule v1')
@Controller({ path: 'parent', version: '1' })
export class ParentScheduleController {
  constructor(private readonly parentService: ParentService) {}

  @Get('me/weekly-schedule')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get weekly schedule for parent children',
    description:
      'Returns weekly schedule with days, sessions, courses, and section info. ' +
      'Pass studentId to filter by one child, or omit to return schedules for all children.',
  })
  @ApiOkResponse({ type: ParentWeeklyScheduleResponseDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getWeeklySchedule(
    @Req() request: Request & { user: AuthenticatedParent },
    @Query() query: ParentWeeklyScheduleQueryDto,
  ): Promise<ParentWeeklyScheduleResponseDto> {
    return this.parentService.getWeeklySchedule(request.user, query.studentId);
  }
}
