import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
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

  @Get('registrations/:id')
  @ApiOperation({ summary: 'Get a registration' })
  @ApiOkResponse({ type: DashboardRegistrationItemDto })
  getRegistration(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardRegistrationItemDto> {
    return this.dashboardRegistrationsService.getRegistration(request.user, id);
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
