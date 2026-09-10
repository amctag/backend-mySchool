import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
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
import { TeacherMessageResponseDto } from './dto/teacher-auth.dto';
import {
  SaveTeacherGradeSheetDto,
  TeacherGradeEntryContextDto,
  TeacherGradeEntryQueryDto,
  TeacherGradeOptionsResponseDto,
  TeacherGradeSheetsResponseDto,
  TeacherGradesQueryDto,
} from './dto/teacher-grades.dto';
import { TeacherGradesService } from './teacher-grades.service';

@ApiTags('Teacher Grades v1')
@ApiBearerAuth()
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherGradesController {
  constructor(private readonly teacherGradesService: TeacherGradesService) {}

  @Get('me/grades/options')
  @ApiOperation({
    summary: 'List my grade entry options',
    description:
      'Classes, sections, and courses the logged-in teacher is assigned to, plus school grade types and course coefficients.',
  })
  @ApiOkResponse({ type: TeacherGradeOptionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listOptions(
    @Req() request: Request & { user: AuthenticatedTeacher },
  ): Promise<TeacherGradeOptionsResponseDto> {
    return this.teacherGradesService.listOptions(request.user);
  }

  @Get('me/grades/entry')
  @ApiOperation({
    summary: 'Load students for grade entry',
    description:
      'Returns roster scores for one assigned section and course. Students load only after class, section, course, and grade type are chosen.',
  })
  @ApiOkResponse({ type: TeacherGradeEntryContextDto })
  @ApiForbiddenResponse({
    description: 'Teacher is not assigned to this class, section, and course',
  })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getEntry(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Query() query: TeacherGradeEntryQueryDto,
  ): Promise<TeacherGradeEntryContextDto> {
    return this.teacherGradesService.getEntry(request.user, query);
  }

  @Get('me/grades')
  @ApiOperation({
    summary: 'List my grade sheets',
    description:
      'Grade sheets for courses the logged-in teacher teaches. Not school-wide.',
  })
  @ApiOkResponse({ type: TeacherGradeSheetsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listSheets(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Query() query: TeacherGradesQueryDto,
  ): Promise<TeacherGradeSheetsResponseDto> {
    return this.teacherGradesService.listSheets(request.user, query);
  }

  @Post('me/grades')
  @ApiOperation({
    summary: 'Save grades for each student',
    description:
      'Creates or updates the grade sheet for one assigned section, course, and grade type.',
  })
  @ApiCreatedResponse({ type: TeacherGradeEntryContextDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({
    description: 'Teacher is not assigned to this class, section, and course',
  })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  saveSheet(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Body() dto: SaveTeacherGradeSheetDto,
  ): Promise<TeacherGradeEntryContextDto> {
    return this.teacherGradesService.saveSheet(request.user, dto);
  }

  @Delete('me/grades/:gradeId')
  @ApiOperation({ summary: 'Delete a grade sheet for one of my courses' })
  @ApiOkResponse({ type: TeacherMessageResponseDto })
  @ApiNotFoundResponse({ description: 'Grade sheet not found' })
  @ApiForbiddenResponse({
    description: 'Teacher is not assigned to this class, section, and course',
  })
  deleteSheet(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('gradeId', ParseIntPipe) gradeId: number,
  ): Promise<TeacherMessageResponseDto> {
    return this.teacherGradesService.deleteSheet(request.user, gradeId);
  }
}
