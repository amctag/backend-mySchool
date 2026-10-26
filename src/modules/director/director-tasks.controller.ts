import {
  Body,
  Controller,
  Delete,
  Post,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  TeacherTasksQueryDto,
  TeacherTaskItemDto,
  TeacherTasksResponseDto,
} from './dto/director-tasks.dto';
import { DirectorTasksService } from './director-tasks.service';
import { buildPaginationMeta, resolvePagination } from '../../common/dto/pagination-query.dto';

@ApiTags('Director Tasks v1')
@ApiBearerAuth()
@Roles('director')
@Controller({ path: 'director', version: '1' })
export class DirectorTasksController {
  constructor(private readonly directorTasksService: DirectorTasksService) {}

  @Get('me/tasks')
  @ApiOperation({
    summary: 'List tasks for directors school',
    description: 'Returns tasks for the directors assigned school.',
  })
  @ApiOkResponse({ type: TeacherTasksResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listTasks(
    @Req() request: { user: AuthenticatedDirector },
    @Query() query: TeacherTasksQueryDto,
  ): Promise<TeacherTasksResponseDto> {
    return this.directorTasksService.listTasks(request.user, query);
  }

  @Get('me/tasks/:id')
  @ApiOperation({
    summary: 'Get task by id for directors school',
    description: 'Returns a specific task by ID.',
  })
  @ApiOkResponse({ type: TeacherTaskItemDto })
  @ApiForbiddenResponse({ description: 'Task not in directors school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getTask(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') taskId: number,
  ): Promise<TeacherTaskItemDto> {
    return this.directorTasksService.getTask(request.user, taskId);
  }

  @Post('me/tasks')
  @ApiOperation({
    summary: 'Create task for directors school',
    description: 'Creates a new task in the directors assigned school.',
  })
  @ApiCreatedResponse({ type: TeacherTaskItemDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: 'Director cannot create tasks' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  createTask(
    @Req() request: { user: AuthenticatedDirector },
    @Body() dto: any,
  ): Promise<TeacherTaskItemDto> {
    return this.directorTasksService.createTask(request.user, dto);
  }

  @Patch('me/tasks/:id')
  @ApiOperation({
    summary: 'Update task for directors school',
    description: 'Updates an existing task in the directors school.',
  })
  @ApiOkResponse({ type: TeacherTaskItemDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: 'Task not in directors school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  updateTask(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') taskId: number,
    @Body() dto: any,
  ): Promise<TeacherTaskItemDto> {
    return this.directorTasksService.updateTask(request.user, taskId, dto);
  }

  @Delete('me/tasks/:id')
  @ApiOperation({
    summary: 'Delete task for directors school',
    description: 'Deletes a task from the directors school.',
  })
  @ApiOkResponse({ type: Boolean })
  @ApiForbiddenResponse({ description: 'Task not in directors school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  deleteTask(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') taskId: number,
  ): Promise<boolean> {
    return this.directorTasksService.deleteTask(request.user, taskId);
  }
}