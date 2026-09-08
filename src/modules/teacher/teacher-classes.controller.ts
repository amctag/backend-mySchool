import { Controller, Get, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  TeacherClassDetailsResponseDto,
  TeacherClassesQueryDto,
  TeacherClassesResponseDto,
  TeacherClassStudentsResponseDto,
} from './dto/teacher-classes.dto';
import { TeacherClassesService } from './teacher-classes.service';

@ApiTags('Teacher Classes v1')
@ApiBearerAuth()
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherClassesController {
  constructor(private readonly teacherClassesService: TeacherClassesService) {}

  @Get('me/classes')
  @ApiOperation({
    summary: 'List my classes',
    description:
      'Sections the logged-in teacher is assigned to in the current year. class id is the section id used by the teacher app.',
  })
  @ApiOkResponse({ type: TeacherClassesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listMyClasses(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Query() query: TeacherClassesQueryDto,
  ): Promise<TeacherClassesResponseDto> {
    return this.teacherClassesService.listAssignedClasses(request.user, query);
  }

  @Get('me/class-schedules')
  @ApiOperation({
    summary: 'List all class schedules',
    description:
      'All school sections for the current year. Assigned classes are flagged with isAssignedToCurrentTeacher.',
  })
  @ApiOkResponse({ type: TeacherClassesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listClassSchedules(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Query() query: TeacherClassesQueryDto,
  ): Promise<TeacherClassesResponseDto> {
    return this.teacherClassesService.listAllClassSchedules(request.user, query);
  }

  @Get('me/classes/:classId/students')
  @ApiOperation({
    summary: 'List students in one of my classes',
    description:
      'Active registrations for a section the teacher is assigned to. Returns 403 if the class is not assigned.',
  })
  @ApiOkResponse({ type: TeacherClassStudentsResponseDto })
  @ApiForbiddenResponse({ description: 'Teacher is not assigned to this class' })
  @ApiNotFoundResponse({ description: 'Class not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listClassStudents(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('classId', ParseIntPipe) classId: number,
  ): Promise<TeacherClassStudentsResponseDto> {
    return this.teacherClassesService.listClassStudents(request.user, classId);
  }

  @Get('me/classes/:classId')
  @ApiOperation({
    summary: 'Get class details',
    description:
      'Class summary, student roster, weekly schedule, and teachers for a section in the teacher school.',
  })
  @ApiOkResponse({ type: TeacherClassDetailsResponseDto })
  @ApiNotFoundResponse({ description: 'Class not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getClassDetails(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('classId', ParseIntPipe) classId: number,
  ): Promise<TeacherClassDetailsResponseDto> {
    return this.teacherClassesService.getClassDetails(request.user, classId);
  }
}
