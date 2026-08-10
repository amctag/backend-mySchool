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
import { ParentAttendanceAbsencesQueryDto } from './dto/parent-attendance-absences-query.dto';
import { ParentAttendanceAbsencesResponseDto } from './dto/parent-attendance-absences-response.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Attendance v1')
@Controller({ path: 'parent', version: '1' })
export class ParentAttendanceController {
  constructor(private readonly parentService: ParentService) {}

  @Get('me/attendance/absences')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get absence days for the logged-in parent children',
    description:
      'Returns only days when the child did not attend school (status = absent). ' +
      'Filter by month (YYYY-MM). Pass studentId for one child, or omit for all children.',
  })
  @ApiOkResponse({ type: ParentAttendanceAbsencesResponseDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getAttendanceAbsences(
    @Req() request: Request & { user: AuthenticatedParent },
    @Query() query: ParentAttendanceAbsencesQueryDto,
  ): Promise<ParentAttendanceAbsencesResponseDto> {
    return this.parentService.getAttendanceAbsences(
      request.user,
      query.month,
      query.studentId,
    );
  }
}
