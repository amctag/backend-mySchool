import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
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
import { DashboardClassItemDto, DashboardStageItemDto } from './dto/dashboard-class-item.dto';
import { DashboardClassesQueryDto } from './dto/dashboard-classes-query.dto';
import { DashboardClassesResponseDto } from './dto/dashboard-classes-response.dto';
import { DashboardClassesService } from './dashboard-classes.service';

@ApiTags('Dashboard Classes v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/classes', version: '1' })
export class DashboardClassesController {
  constructor(
    private readonly dashboardClassesService: DashboardClassesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List classes for this school (read-only catalog)',
  })
  @ApiOkResponse({ type: DashboardClassesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid school session' })
  @ApiForbiddenResponse({ description: 'Not a school admin' })
  listClasses(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardClassesQueryDto,
  ): Promise<DashboardClassesResponseDto> {
    return this.dashboardClassesService.listClasses(request.user, query);
  }

  @Get('stages')
  @ApiOperation({ summary: 'List stages for this school' })
  @ApiOkResponse({ type: [DashboardStageItemDto] })
  listStages(
    @Req() request: Request & { user: AuthenticatedSchool },
  ): Promise<DashboardStageItemDto[]> {
    return this.dashboardClassesService.listStages(request.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one class for this school' })
  @ApiOkResponse({ type: DashboardClassItemDto })
  getClass(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardClassItemDto> {
    return this.dashboardClassesService.getClass(request.user, id);
  }
}
