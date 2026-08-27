import {
  Body,
  Controller,
  Get,
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
import { CreateDashboardStudentDto } from './dto/create-dashboard-student.dto';
import { DashboardChildrenQueryDto } from './dto/dashboard-children-query.dto';
import { DashboardChildrenResponseDto } from './dto/dashboard-children-response.dto';
import { DashboardStudentDetailDto } from './dto/dashboard-student-detail.dto';
import { UpdateDashboardStudentDto } from './dto/update-dashboard-student.dto';
import { DashboardChildrenService } from './dashboard-children.service';
import { DashboardStudentsService } from './dashboard-students.service';

@ApiTags('Dashboard Students v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/students', version: '1' })
export class DashboardStudentsController {
  constructor(
    private readonly dashboardStudentsService: DashboardStudentsService,
    private readonly dashboardChildrenService: DashboardChildrenService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List school students with pagination and search',
  })
  @ApiOkResponse({ type: DashboardChildrenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid school session' })
  @ApiForbiddenResponse({ description: 'Not a school admin' })
  listStudents(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardChildrenQueryDto,
  ): Promise<DashboardChildrenResponseDto> {
    return this.dashboardChildrenService.listChildren(request.user, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a student for this school' })
  @ApiCreatedResponse({ type: DashboardStudentDetailDto })
  createStudent(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardStudentDto,
  ): Promise<DashboardStudentDetailDto> {
    return this.dashboardStudentsService.createStudent(request.user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a student for edit' })
  @ApiOkResponse({ type: DashboardStudentDetailDto })
  getStudent(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardStudentDetailDto> {
    return this.dashboardStudentsService.getStudent(request.user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a student' })
  @ApiOkResponse({ type: DashboardStudentDetailDto })
  updateStudent(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardStudentDto,
  ): Promise<DashboardStudentDetailDto> {
    return this.dashboardStudentsService.updateStudent(request.user, id, dto);
  }
}
