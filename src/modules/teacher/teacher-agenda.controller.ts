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
  TeacherAgendaItemDto,
  TeacherAgendasQueryDto,
  TeacherAgendasResponseDto,
  UpsertTeacherAgendaDto,
} from './dto/teacher-agenda.dto';
import { TeacherAgendaService } from './teacher-agenda.service';

@ApiTags('Teacher Agendas v1')
@ApiBearerAuth()
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherAgendaController {
  constructor(private readonly teacherAgendaService: TeacherAgendaService) {}

  @Get('me/agendas')
  @ApiOperation({
    summary: 'List my agendas',
    description:
      'Agendas created by the logged-in teacher. Optional classId filters by assigned section.',
  })
  @ApiOkResponse({ type: TeacherAgendasResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listAgendas(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Query() query: TeacherAgendasQueryDto,
  ): Promise<TeacherAgendasResponseDto> {
    return this.teacherAgendaService.listAgendas(request.user, query);
  }

  @Post('me/agendas')
  @ApiOperation({
    summary: 'Create an agenda',
    description:
      'Creates a course agenda for an assigned class (section) the logged-in teacher teaches.',
  })
  @ApiCreatedResponse({ type: TeacherAgendaItemDto })
  @ApiBadRequestResponse({
    description: 'Validation failed or classId does not match the assignment',
  })
  @ApiForbiddenResponse({ description: 'Teacher is not assigned to this class' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  createAgenda(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Body() dto: UpsertTeacherAgendaDto,
  ): Promise<TeacherAgendaItemDto> {
    return this.teacherAgendaService.createAgenda(request.user, dto);
  }

  @Get('me/agendas/:agendaId')
  @ApiOperation({ summary: 'Get one of my agendas' })
  @ApiOkResponse({ type: TeacherAgendaItemDto })
  @ApiNotFoundResponse({ description: 'Agenda not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getAgenda(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('agendaId', ParseIntPipe) agendaId: number,
  ): Promise<TeacherAgendaItemDto> {
    return this.teacherAgendaService.getAgenda(request.user, agendaId);
  }
}
