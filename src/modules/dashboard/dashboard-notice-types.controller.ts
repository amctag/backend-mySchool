import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateDashboardNoticeTypeDto } from './dto/create-dashboard-notice-type.dto';
import { DashboardNoticeTypeItemDto } from './dto/dashboard-notices-response.dto';
import { UpdateDashboardNoticeTypeDto } from './dto/update-dashboard-notice-type.dto';
import { DashboardNoticeTypesService } from './dashboard-notice-types.service';

@ApiTags('Dashboard Notice Types v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/notice-types', version: '1' })
export class DashboardNoticeTypesController {
  constructor(
    private readonly dashboardNoticeTypesService: DashboardNoticeTypesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notice types' })
  @ApiOkResponse({ type: [DashboardNoticeTypeItemDto] })
  listTypes(
    @Req() request: Request & { user: AuthenticatedSchool },
  ): Promise<DashboardNoticeTypeItemDto[]> {
    return this.dashboardNoticeTypesService.listTypes(request.user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a notice type' })
  @ApiCreatedResponse({ type: DashboardNoticeTypeItemDto })
  createType(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardNoticeTypeDto,
  ): Promise<DashboardNoticeTypeItemDto> {
    return this.dashboardNoticeTypesService.createType(request.user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one notice type' })
  @ApiOkResponse({ type: DashboardNoticeTypeItemDto })
  getType(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardNoticeTypeItemDto> {
    return this.dashboardNoticeTypesService.getType(request.user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a notice type' })
  @ApiOkResponse({ type: DashboardNoticeTypeItemDto })
  updateType(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardNoticeTypeDto,
  ): Promise<DashboardNoticeTypeItemDto> {
    return this.dashboardNoticeTypesService.updateType(request.user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete a notice type' })
  async deleteType(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.dashboardNoticeTypesService.deleteType(request.user, id);
  }
}
