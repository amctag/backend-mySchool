import {
  Controller,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DirectorScheduleQueryDto,
  DirectorScheduleResponseDto,
} from './dto/director-schedule.dto';
import { DirectorScheduleService } from './director-schedule.service';

@ApiTags('Director Schedule v1')
@ApiBearerAuth()
@Roles('director')
@Controller({ path: 'director', version: '1' })
export class DirectorScheduleController {
  constructor(private readonly directorScheduleService: DirectorScheduleService) {}

  @Get('me/schedule')
  @ApiOperation({
    summary: 'Get director weekly schedule for the school',
    description:
      'Returns the weekly timetable for all classes in the director\'s assigned school.',
  })
  @ApiOkResponse({ type: DirectorScheduleResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getSchedule(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Query() query: DirectorScheduleQueryDto,
  ): Promise<DirectorScheduleResponseDto> {
    return this.directorScheduleService.getSchedule(request.user);
  }

  @Get('me/assignments')
  @ApiOperation({
    summary: 'List all teaching assignments in the director\'s school',
    description:
      'Paginated Teach rows for the current year in the director\'s assigned school.',
  })
  @ApiOkResponse({ type: DirectorScheduleResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listAssignments(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Query() query: DirectorScheduleQueryDto,
  ): Promise<DirectorScheduleResponseDto> {
    return this.directorScheduleService.listAssignments(request.user, query);
  }
}