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
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardGradesByCourseQueryDto } from './dto/dashboard-grades-by-course-query.dto';
import {
  DashboardGradeByCourseCandidatesResponseDto,
  DashboardGradeByCourseDetailResponseDto,
  DashboardGradesByCourseResponseDto,
} from './dto/dashboard-grades-by-course-response.dto';
import { DashboardGradeTypesListResponseDto } from './dto/dashboard-grade-types-list-response.dto';
import { DashboardGradeCardQueryDto } from './dto/dashboard-grade-card-query.dto';
import { DashboardGradeCardResponseDto } from './dto/dashboard-grade-card-response.dto';
import { SaveDashboardGradeByCourseDto } from './dto/save-dashboard-grade-by-course.dto';
import { DashboardGradesService } from './dashboard-grades.service';

@ApiTags('Dashboard Grades v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/grades', version: '1' })
export class DashboardGradesController {
  constructor(private readonly dashboardGradesService: DashboardGradesService) {}

  @Get('grade-types')
  @ApiOperation({ summary: 'List grade types for grade entry' })
  @ApiOkResponse({ type: DashboardGradeTypesListResponseDto })
  listGradeTypes(
    @Req() request: Request & { user: AuthenticatedSchool },
  ): Promise<DashboardGradeTypesListResponseDto> {
    return this.dashboardGradesService.listGradeTypes(request.user);
  }

  @Get('grade-card')
  @ApiOperation({
    summary: 'Grade card matrix for one student (courses × grade types)',
  })
  @ApiOkResponse({ type: DashboardGradeCardResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  getGradeCard(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardGradeCardQueryDto,
  ): Promise<DashboardGradeCardResponseDto> {
    return this.dashboardGradesService.getGradeCard(request.user, query);
  }

  @Get('by-course')
  @ApiOperation({ summary: 'List grade sheets by course' })
  @ApiOkResponse({ type: DashboardGradesByCourseResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listGradesByCourse(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardGradesByCourseQueryDto,
  ): Promise<DashboardGradesByCourseResponseDto> {
    return this.dashboardGradesService.listGradesByCourse(request.user, query);
  }

  @Get('by-course/candidates')
  @ApiOperation({
    summary: 'List students in a section for grade entry',
  })
  @ApiOkResponse({ type: DashboardGradeByCourseCandidatesResponseDto })
  getGradeByCourseCandidates(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query('sectionId', ParseIntPipe) sectionId: number,
    @Query('courseId', ParseIntPipe) courseId: number,
    @Query('gradeTypeId', ParseIntPipe) gradeTypeId: number,
  ): Promise<DashboardGradeByCourseCandidatesResponseDto> {
    return this.dashboardGradesService.getGradeByCourseCandidates(
      request.user,
      sectionId,
      courseId,
      gradeTypeId,
    );
  }

  @Get('by-course/:id')
  @ApiOperation({ summary: 'Get a grade sheet with student scores' })
  @ApiOkResponse({ type: DashboardGradeByCourseDetailResponseDto })
  getGradeByCourse(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardGradeByCourseDetailResponseDto> {
    return this.dashboardGradesService.getGradeByCourse(request.user, id);
  }

  @Post('by-course')
  @ApiOperation({ summary: 'Create or update a grade sheet for a section' })
  @ApiCreatedResponse({ type: DashboardGradeByCourseDetailResponseDto })
  saveGradeByCourse(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() body: SaveDashboardGradeByCourseDto,
  ): Promise<DashboardGradeByCourseDetailResponseDto> {
    return this.dashboardGradesService.saveGradeByCourse(request.user, body);
  }
}
