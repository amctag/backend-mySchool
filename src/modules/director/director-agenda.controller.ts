import {
  Body,
  Controller,
  Delete,
  Post,
  Get,
  Param,
  Patch,
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
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DirectorAgendasQueryDto,
  DirectorAgendaItemDto,
  DirectorAgendasResponseDto,
} from './dto/director-agenda.dto';
import { DirectorAgendaService } from './director-agenda.service';

@ApiTags('Director Agenda v1')
@ApiBearerAuth()
@Roles('director')
@Controller({ path: 'director', version: '1' })
export class DirectorAgendaController {
  constructor(private readonly directorAgendaService: DirectorAgendaService) {}

  @Get('me/agenda')
  @ApiOperation({
    summary: 'List agendas for directors school',
    description: 'Returns agendas for the directors assigned school, filterable by date.',
  })
  @ApiOkResponse({ type: DirectorAgendasResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listAgendas(
    @Req() request: { user: AuthenticatedDirector },
    @Query() query: DirectorAgendasQueryDto,
  ): Promise<DirectorAgendasResponseDto> {
    return this.directorAgendaService.listAgendas(request.user, query);
  }

  @Get('me/agenda/:id')
  @ApiOperation({
    summary: 'Get agenda by id for directors school',
    description: 'Returns a specific agenda item by ID.',
  })
  @ApiOkResponse({ type: DirectorAgendaItemDto })
  @ApiForbiddenResponse({ description: 'Agenda not in directors school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getAgenda(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') agendaId: number,
  ): Promise<DirectorAgendaItemDto> {
    return this.directorAgendaService.getAgenda(request.user, agendaId);
  }

  @Post('me/agenda')
  @ApiOperation({
    summary: 'Create agenda for directors school',
    description: 'Creates a new agenda item in the directors assigned school.',
  })
  @ApiCreatedResponse({ type: DirectorAgendaItemDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: 'Director cannot create agenda items' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  createAgenda(
    @Req() request: { user: AuthenticatedDirector },
    @Body() dto: any,
  ): Promise<DirectorAgendaItemDto> {
    return this.directorAgendaService.createAgenda(request.user, dto);
  }

  @Patch('me/agenda/:id')
  @ApiOperation({
    summary: 'Update agenda for directors school',
    description: 'Updates an existing agenda item in the directors school.',
  })
  @ApiOkResponse({ type: DirectorAgendaItemDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: 'Agenda not in directors school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  updateAgenda(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') agendaId: number,
    @Body() dto: any,
  ): Promise<DirectorAgendaItemDto> {
    return this.directorAgendaService.updateAgenda(request.user, agendaId, dto);
  }

  @Patch('me/agenda/:id/publish')
  @ApiOperation({
    summary: 'Publish agenda for directors school',
    description: 'Publishes a draft agenda item in the directors school.',
  })
  @ApiOkResponse({ type: DirectorAgendaItemDto })
  @ApiForbiddenResponse({ description: 'Agenda not in directors school or director cannot publish' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  publishAgenda(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') agendaId: number,
  ): Promise<DirectorAgendaItemDto> {
    return this.directorAgendaService.publishAgenda(request.user, agendaId);
  }

  @Delete('me/agenda/:id')
  @ApiOperation({
    summary: 'Delete agenda for directors school',
    description: 'Deletes an agenda item from the directors school.',
  })
  @ApiOkResponse({ type: Boolean })
  @ApiForbiddenResponse({ description: 'Agenda not in directors school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  deleteAgenda(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') agendaId: number,
  ): Promise<boolean> {
    return this.directorAgendaService.deleteAgenda(request.user, agendaId);
  }
}