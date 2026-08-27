import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardParentsQueryDto } from './dto/dashboard-parents-query.dto';
import { DashboardParentsResponseDto } from './dto/dashboard-parents-response.dto';
import { DashboardParentsService } from './dashboard-parents.service';

@ApiTags('Dashboard Parents v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/parents', version: '1' })
export class DashboardParentsController {
  constructor(
    private readonly dashboardParentsService: DashboardParentsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List school parents with pagination, name/id filters, and search',
  })
  @ApiOkResponse({ type: DashboardParentsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid school session' })
  @ApiForbiddenResponse({ description: 'Not a school admin' })
  listParents(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardParentsQueryDto,
  ): Promise<DashboardParentsResponseDto> {
    return this.dashboardParentsService.listParents(request.user, query);
  }
}
