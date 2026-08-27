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
import { CreateDashboardTeacherDto } from './dto/create-dashboard-teacher.dto';
import { DashboardTeacherDetailDto } from './dto/dashboard-teacher-detail.dto';
import { DashboardTeachersQueryDto } from './dto/dashboard-teachers-query.dto';
import { DashboardTeachersResponseDto } from './dto/dashboard-teachers-response.dto';
import { UpdateDashboardTeacherDto } from './dto/update-dashboard-teacher.dto';
import { DashboardTeachersService } from './dashboard-teachers.service';

@ApiTags('Dashboard Teachers v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/teachers', version: '1' })
export class DashboardTeachersController {
  constructor(
    private readonly dashboardTeachersService: DashboardTeachersService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List school teachers with pagination, search, and sort',
  })
  @ApiOkResponse({ type: DashboardTeachersResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid school session' })
  @ApiForbiddenResponse({ description: 'Not a school admin' })
  listTeachers(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardTeachersQueryDto,
  ): Promise<DashboardTeachersResponseDto> {
    return this.dashboardTeachersService.listTeachers(request.user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a teacher for this school' })
  @ApiCreatedResponse({ type: DashboardTeacherDetailDto })
  createTeacher(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardTeacherDto,
  ): Promise<DashboardTeacherDetailDto> {
    return this.dashboardTeachersService.createTeacher(request.user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a teacher for view or edit' })
  @ApiOkResponse({ type: DashboardTeacherDetailDto })
  getTeacher(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardTeacherDetailDto> {
    return this.dashboardTeachersService.getTeacher(request.user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a teacher' })
  @ApiOkResponse({ type: DashboardTeacherDetailDto })
  updateTeacher(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardTeacherDto,
  ): Promise<DashboardTeacherDetailDto> {
    return this.dashboardTeachersService.updateTeacher(request.user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a teacher from this school' })
  deleteTeacher(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.dashboardTeachersService.deleteTeacher(request.user, id);
  }
}
