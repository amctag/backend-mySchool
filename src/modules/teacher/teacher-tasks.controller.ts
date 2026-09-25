import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  TeacherTaskItemDto,
  TeacherTasksResponseDto,
} from './dto/teacher-tasks.dto';
import { TeacherTasksService } from './teacher-tasks.service';

@ApiTags('Teacher Tasks v1')
@ApiBearerAuth()
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherTasksController {
  constructor(private readonly teacherTasksService: TeacherTasksService) {}

  @Get('me/tasks')
  @ApiOperation({
    summary: 'List school tasks for me',
    description:
      'Returns tasks created by the school for all teachers, with my completion status.',
  })
  @ApiOkResponse({ type: TeacherTasksResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listTasks(
    @Req() request: Request & { user: AuthenticatedTeacher },
  ): Promise<TeacherTasksResponseDto> {
    return this.teacherTasksService.listTasks(request.user);
  }

  @Patch('me/tasks/:taskId/complete')
  @ApiOperation({ summary: 'Mark a task as done' })
  @ApiOkResponse({ type: TeacherTaskItemDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  completeTask(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('taskId', ParseIntPipe) taskId: number,
  ): Promise<TeacherTaskItemDto> {
    return this.teacherTasksService.completeTask(request.user, taskId);
  }
}
