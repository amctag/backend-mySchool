import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { TeacherMessageResponseDto } from './dto/teacher-auth.dto';
import { TeacherAgendaService } from './teacher-agenda.service';

@ApiTags('Teacher Agendas v1')
@ApiBearerAuth()
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherAgendaController {
  constructor(private readonly teacherAgendaService: TeacherAgendaService) {}

  @Get('me/agendas')
  @ApiOperation({
    summary: 'List agendas for my classes',
    description:
      'Agendas linked to sections the teacher teaches (not only agendas they created). Optional classId, agendaDate (YYYY-MM-DD), or month (YYYY-MM) filters. isOwn marks items the teacher can edit.',
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
      'Creates a course agenda for an assigned class. Unpublished drafts are hidden from parents.',
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
  @ApiOperation({
    summary: 'Get one agenda for my classes',
    description:
      'Returns an agenda in a section the teacher teaches. Edit/delete remain limited to agendas they created (isOwn).',
  })
  @ApiOkResponse({ type: TeacherAgendaItemDto })
  @ApiNotFoundResponse({ description: 'Agenda not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getAgenda(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('agendaId', ParseIntPipe) agendaId: number,
  ): Promise<TeacherAgendaItemDto> {
    return this.teacherAgendaService.getAgenda(request.user, agendaId);
  }

  @Post('me/agendas/:agendaId/publish')
  @ApiOperation({
    summary: 'Publish an agenda',
    description:
      'Makes an agenda visible to parents of the assigned class.',
  })
  @ApiOkResponse({ type: TeacherAgendaItemDto })
  @ApiNotFoundResponse({ description: 'Agenda not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  publishAgenda(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('agendaId', ParseIntPipe) agendaId: number,
  ): Promise<TeacherAgendaItemDto> {
    return this.teacherAgendaService.publishAgenda(request.user, agendaId);
  }

  @Patch('me/agendas/:agendaId')
  @ApiOperation({
    summary: 'Update an agenda',
    description:
      'Updates an agenda the logged-in teacher created. Parents are notified when the saved item is published.',
  })
  @ApiOkResponse({ type: TeacherAgendaItemDto })
  @ApiBadRequestResponse({
    description: 'Validation failed or classId does not match the assignment',
  })
  @ApiForbiddenResponse({ description: 'Teacher is not assigned to this class' })
  @ApiNotFoundResponse({ description: 'Agenda not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  updateAgenda(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('agendaId', ParseIntPipe) agendaId: number,
    @Body() dto: UpsertTeacherAgendaDto,
  ): Promise<TeacherAgendaItemDto> {
    return this.teacherAgendaService.updateAgenda(
      request.user,
      agendaId,
      dto,
    );
  }

  @Delete('me/agendas/:agendaId')
  @ApiOperation({
    summary: 'Delete an agenda',
    description: 'Soft-deletes an agenda the logged-in teacher created.',
  })
  @ApiOkResponse({ type: TeacherMessageResponseDto })
  @ApiNotFoundResponse({ description: 'Agenda not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  deleteAgenda(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('agendaId', ParseIntPipe) agendaId: number,
  ): Promise<TeacherMessageResponseDto> {
    return this.teacherAgendaService.deleteAgenda(request.user, agendaId);
  }
}
