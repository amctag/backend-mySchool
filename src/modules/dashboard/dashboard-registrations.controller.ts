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
import { CreateDashboardRegistrationDto } from './dto/create-dashboard-registration.dto';
import { DashboardRegistrationsQueryDto } from './dto/dashboard-registrations-query.dto';
import {
  DashboardRegistrationItemDto,
  DashboardRegistrationsResponseDto,
} from './dto/dashboard-registrations-response.dto';
import {
  BulkProgressDashboardRegistrationDto,
  BulkProgressRegistrationsResponseDto,
  ProgressDashboardRegistrationDto,
} from './dto/progress-dashboard-registration.dto';
import { UpdateDashboardRegistrationDto } from './dto/update-dashboard-registration.dto';
import { DashboardRegistrationsService } from './dashboard-registrations.service';

@ApiTags('Dashboard Registrations v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard', version: '1' })
export class DashboardRegistrationsController {
  constructor(
    private readonly dashboardRegistrationsService: DashboardRegistrationsService,
  ) {}

  @Get('registrations')
  @ApiOperation({ summary: 'List student registrations' })
  @ApiOkResponse({ type: DashboardRegistrationsResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listRegistrations(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardRegistrationsQueryDto,
  ): Promise<DashboardRegistrationsResponseDto> {
    return this.dashboardRegistrationsService.listRegistrations(
      request.user,
      query,
    );
  }

  @Post('registrations')
  @ApiOperation({ summary: 'Register a student into a class section' })
  @ApiCreatedResponse({ type: DashboardRegistrationItemDto })
  createRegistration(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardRegistrationDto,
  ): Promise<DashboardRegistrationItemDto> {
    return this.dashboardRegistrationsService.createRegistration(
      request.user,
      dto,
    );
  }

  @Post('registrations/progress')
  @ApiOperation({
    summary: 'Bulk create next-year registrations (up / down / stay)',
    description:
      'Processes many registrations in one request. Each item returns ok/fail independently.',
  })
  @ApiOkResponse({ type: BulkProgressRegistrationsResponseDto })
  bulkProgressRegistrations(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: BulkProgressDashboardRegistrationDto,
  ): Promise<BulkProgressRegistrationsResponseDto> {
    return this.dashboardRegistrationsService.bulkProgressRegistrations(
      request.user,
      dto,
    );
  }

  @Get('registrations/:id')
  @ApiOperation({ summary: 'Get a registration' })
  @ApiOkResponse({ type: DashboardRegistrationItemDto })
  getRegistration(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardRegistrationItemDto> {
    return this.dashboardRegistrationsService.getRegistration(request.user, id);
  }

  @Patch('registrations/:id')
  @ApiOperation({ summary: 'Update a registration' })
  @ApiOkResponse({ type: DashboardRegistrationItemDto })
  updateRegistration(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardRegistrationDto,
  ): Promise<DashboardRegistrationItemDto> {
    return this.dashboardRegistrationsService.updateRegistration(
      request.user,
      id,
      dto,
    );
  }

  @Post('registrations/:id/progress')
  @ApiOperation({
    summary: 'Create next-year registration (up / down / stay)',
    description:
      'Creates a new registration for the next school year. ' +
      'up moves to classLevel + 1, down to classLevel - 1, stay keeps the same class. ' +
      'Uses the first section of the target class. The current registration is kept.',
  })
  @ApiCreatedResponse({ type: DashboardRegistrationItemDto })
  progressRegistration(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProgressDashboardRegistrationDto,
  ): Promise<DashboardRegistrationItemDto> {
    return this.dashboardRegistrationsService.progressRegistration(
      request.user,
      id,
      dto,
    );
  }

  @Delete('registrations/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deactivate a registration' })
  deleteRegistration(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.dashboardRegistrationsService.deleteRegistration(
      request.user,
      id,
    );
  }
}
