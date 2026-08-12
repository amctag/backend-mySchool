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
import { ParentAgendasQueryDto } from './dto/parent-agendas-query.dto';
import { ParentAgendasResponseDto } from './dto/parent-agendas-response.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Agendas v1')
@Controller({ path: 'parent', version: '1' })
export class ParentAgendaController {
  constructor(private readonly parentService: ParentService) {}

  @Get('me/agendas')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get course agendas for the logged-in parent children',
    description:
      'Returns published agendas when the child section is a recipient. ' +
      'Pass month in YYYY-MM format. Optionally filter by studentId. Supports page and limit pagination.',
  })
  @ApiOkResponse({ type: ParentAgendasResponseDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getAgendas(
    @Req() request: Request & { user: AuthenticatedParent },
    @Query() query: ParentAgendasQueryDto,
  ): Promise<ParentAgendasResponseDto> {
    return this.parentService.getAgendas(
      request.user,
      query.month,
      query.studentId,
      query.page ?? 1,
      query.limit ?? 10,
    );
  }
}
