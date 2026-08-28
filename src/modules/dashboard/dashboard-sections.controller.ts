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
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateDashboardSectionDto } from './dto/create-dashboard-section.dto';
import { CreateDashboardSectionTitleDto } from './dto/create-dashboard-section-title.dto';
import { DashboardSectionsQueryDto } from './dto/dashboard-sections-query.dto';
import { UpdateDashboardSectionTitleDto } from './dto/update-dashboard-section-title.dto';
import {
  DashboardSectionItemDto,
  DashboardSectionTitleItemDto,
  DashboardSectionsResponseDto,
  DashboardYearItemDto,
} from './dto/dashboard-sections-response.dto';
import { UpdateDashboardSectionDto } from './dto/update-dashboard-section.dto';
import { DashboardSectionsService } from './dashboard-sections.service';

@ApiTags('Dashboard Sections v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard', version: '1' })
export class DashboardSectionsController {
  constructor(
    private readonly dashboardSectionsService: DashboardSectionsService,
  ) {}

  @Get('years')
  @ApiOperation({ summary: 'List school years' })
  @ApiOkResponse({ type: [DashboardYearItemDto] })
  listYears(
    @Req() request: Request & { user: AuthenticatedSchool },
  ): Promise<DashboardYearItemDto[]> {
    return this.dashboardSectionsService.listYears(request.user);
  }

  @Get('section-titles')
  @ApiOperation({
    summary: 'List shared section titles for this school (A, B, C…)',
  })
  @ApiOkResponse({ type: [DashboardSectionTitleItemDto] })
  listSectionTitles(
    @Req() request: Request & { user: AuthenticatedSchool },
  ): Promise<DashboardSectionTitleItemDto[]> {
    return this.dashboardSectionsService.listSectionTitles(request.user);
  }

  @Post('section-titles')
  @ApiOperation({ summary: 'Create a shared section title for this school' })
  @ApiCreatedResponse({ type: DashboardSectionTitleItemDto })
  createSectionTitle(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardSectionTitleDto,
  ): Promise<DashboardSectionTitleItemDto> {
    return this.dashboardSectionsService.createSectionTitle(request.user, dto);
  }

  @Get('section-titles/:id')
  @ApiOperation({ summary: 'Get a section title' })
  @ApiOkResponse({ type: DashboardSectionTitleItemDto })
  getSectionTitle(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardSectionTitleItemDto> {
    return this.dashboardSectionsService.getSectionTitle(request.user, id);
  }

  @Patch('section-titles/:id')
  @ApiOperation({ summary: 'Update a section title' })
  @ApiOkResponse({ type: DashboardSectionTitleItemDto })
  updateSectionTitle(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardSectionTitleDto,
  ): Promise<DashboardSectionTitleItemDto> {
    return this.dashboardSectionsService.updateSectionTitle(
      request.user,
      id,
      dto,
    );
  }

  @Delete('section-titles/:id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a section title if no class sections use it',
  })
  deleteSectionTitle(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.dashboardSectionsService.deleteSectionTitle(request.user, id);
  }

  @Get('sections')
  @ApiOperation({ summary: 'List sections with pagination and search' })
  @ApiOkResponse({ type: DashboardSectionsResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listSections(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardSectionsQueryDto,
  ): Promise<DashboardSectionsResponseDto> {
    return this.dashboardSectionsService.listSections(request.user, query);
  }

  @Post('sections')
  @ApiOperation({ summary: 'Create a section for this school' })
  @ApiCreatedResponse({ type: DashboardSectionItemDto })
  createSection(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardSectionDto,
  ): Promise<DashboardSectionItemDto> {
    return this.dashboardSectionsService.createSection(request.user, dto);
  }

  @Get('sections/:id')
  @ApiOperation({ summary: 'Get a section' })
  @ApiOkResponse({ type: DashboardSectionItemDto })
  getSection(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardSectionItemDto> {
    return this.dashboardSectionsService.getSection(request.user, id);
  }

  @Patch('sections/:id')
  @ApiOperation({ summary: 'Update a section' })
  @ApiOkResponse({ type: DashboardSectionItemDto })
  updateSection(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardSectionDto,
  ): Promise<DashboardSectionItemDto> {
    return this.dashboardSectionsService.updateSection(request.user, id, dto);
  }
}
