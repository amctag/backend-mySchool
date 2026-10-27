import {
  Body,
  Controller,
  Get,
  Post,
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
import { Request } from 'express';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DirectorAttendanceOptionsDto,
  TeacherAttendanceSheetDto,
  DirectorAttendancesQueryDto,
  DirectorAttendanceSheetQueryDto,
  DirectorSaveAttendanceDto,
} from './dto/director-attendance.dto';
import { DirectorAttendanceService } from './director-attendance.service';

@ApiTags('Director Attendances v1')
@ApiBearerAuth()
@Roles('director')
@Controller({ path: 'director', version: '1' })
export class DirectorAttendanceController {
  constructor(private readonly directorAttendanceService: DirectorAttendanceService) {}

  @Get('me/attendances/options')
  @ApiOperation({
    summary: 'List attendance options for director\'s school',
    description:
      'Returns attendance configuration and eligible classes for the director\'s assigned school.',
  })
  @ApiOkResponse({ type: DirectorAttendanceOptionsDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listOptions(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Query() query: any,
  ): Promise<DirectorAttendanceOptionsDto> {
    return this.directorAttendanceService.listOptions(request.user);
  }

  @Get('me/attendances/sheet')
  @ApiOperation({
    summary: 'Load attendance sheet for director',
    description:
      'Returns the attendance roster and any saved marks for an eligible section.',
  })
  @ApiOkResponse({ type: TeacherAttendanceSheetDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getSheet(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Query() query: DirectorAttendanceSheetQueryDto,
  ): Promise<TeacherAttendanceSheetDto> {
    return this.directorAttendanceService.getSheet(request.user, query);
  }

  @Get('me/attendances')
  @ApiOperation({
    summary: 'List attendance records for director\'s school',
    description:
      'Returns attendance records for the director\'s assigned school. Filterable by date.',
  })
  @ApiOkResponse({ type: TeacherAttendanceSheetDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listAttendances(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Query() query: DirectorAttendancesQueryDto,
  ): Promise<any> {
    return this.directorAttendanceService.listAttendances(request.user, query);
  }

  @Post('me/attendances')
  @ApiOperation({
    summary: 'Save attendance for director\'s school',
    description:
      'Creates or replaces the attendance sheet for one section in the director\'s school.',
  })
  @ApiCreatedResponse({ type: TeacherAttendanceSheetDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({
    description: 'Director cannot take attendance for this class',
  })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  saveAttendance(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Body() dto: DirectorSaveAttendanceDto,
  ): Promise<TeacherAttendanceSheetDto> {
    return this.directorAttendanceService.saveAttendance(request.user, dto);
  }
}