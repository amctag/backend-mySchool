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
import { DashboardChildrenQueryDto } from './dto/dashboard-children-query.dto';
import { DashboardChildrenResponseDto } from './dto/dashboard-children-response.dto';
import { DashboardChildrenService } from './dashboard-children.service';

@ApiTags('Dashboard Children v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/children', version: '1' })
export class DashboardChildrenController {
  constructor(
    private readonly dashboardChildrenService: DashboardChildrenService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List school children with pagination, parent filter, name/id filters, and search',
  })
  @ApiOkResponse({ type: DashboardChildrenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid school session' })
  @ApiForbiddenResponse({ description: 'Not a school admin' })
  listChildren(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardChildrenQueryDto,
  ): Promise<DashboardChildrenResponseDto> {
    return this.dashboardChildrenService.listChildren(request.user, query);
  }
}
