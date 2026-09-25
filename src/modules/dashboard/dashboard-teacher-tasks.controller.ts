import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
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
import {
  CreateDashboardTeacherTaskDto,
  DashboardTeacherTaskItemDto,
  DashboardTeacherTasksQueryDto,
  DashboardTeacherTasksResponseDto,
} from './dto/dashboard-teacher-tasks.dto';
import { DashboardTeacherTasksService } from './dashboard-teacher-tasks.service';

@ApiTags('Dashboard Teacher Tasks v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/teacher-tasks', version: '1' })
export class DashboardTeacherTasksController {
  constructor(
    private readonly dashboardTeacherTasksService: DashboardTeacherTasksService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List teacher tasks',
    description:
      'Returns school tasks assigned to all active teachers, newest first.',
  })
  @ApiOkResponse({ type: DashboardTeacherTasksResponseDto })
  listTasks(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardTeacherTasksQueryDto,
  ): Promise<DashboardTeacherTasksResponseDto> {
    return this.dashboardTeacherTasksService.listTasks(request.user, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a teacher task',
    description:
      'Creates a task for all active teachers and sends an FCM notification.',
  })
  @ApiCreatedResponse({ type: DashboardTeacherTaskItemDto })
  createTask(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardTeacherTaskDto,
  ): Promise<DashboardTeacherTaskItemDto> {
    return this.dashboardTeacherTasksService.createTask(request.user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one teacher task by id' })
  @ApiOkResponse({ type: DashboardTeacherTaskItemDto })
  getTask(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardTeacherTaskItemDto> {
    return this.dashboardTeacherTasksService.getTask(request.user, id);
  }
}
