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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateDashboardClassCourseDto } from './dto/create-dashboard-class-course.dto';
import { CreateDashboardCourseDto } from './dto/create-dashboard-course.dto';
import { DashboardClassCoursesQueryDto } from './dto/dashboard-class-courses-query.dto';
import {
  DashboardClassCourseItemDto,
  DashboardClassCoursesResponseDto,
} from './dto/dashboard-class-courses-response.dto';
import { DashboardCourseItemDto } from './dto/dashboard-course-item.dto';
import { UpdateDashboardClassCourseDto } from './dto/update-dashboard-class-course.dto';
import { UpdateDashboardCourseDto } from './dto/update-dashboard-course.dto';
import { DashboardCoursesService } from './dashboard-courses.service';

@ApiTags('Dashboard Courses v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard', version: '1' })
export class DashboardCoursesController {
  constructor(
    private readonly dashboardCoursesService: DashboardCoursesService,
  ) {}

  @Get('courses')
  @ApiOperation({ summary: 'List courses for this school' })
  @ApiOkResponse({ type: [DashboardCourseItemDto] })
  listCourses(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query('search') search?: string,
  ): Promise<DashboardCourseItemDto[]> {
    return this.dashboardCoursesService.listCourses(request.user, search);
  }

  @Post('courses')
  @ApiOperation({ summary: 'Create a course' })
  @ApiCreatedResponse({ type: DashboardCourseItemDto })
  createCourse(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardCourseDto,
  ): Promise<DashboardCourseItemDto> {
    return this.dashboardCoursesService.createCourse(request.user, dto);
  }

  @Get('courses/:id')
  @ApiOperation({ summary: 'Get a course' })
  @ApiOkResponse({ type: DashboardCourseItemDto })
  getCourse(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardCourseItemDto> {
    return this.dashboardCoursesService.getCourse(request.user, id);
  }

  @Patch('courses/:id')
  @ApiOperation({ summary: 'Update a course' })
  @ApiOkResponse({ type: DashboardCourseItemDto })
  updateCourse(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardCourseDto,
  ): Promise<DashboardCourseItemDto> {
    return this.dashboardCoursesService.updateCourse(request.user, id, dto);
  }

  @Delete('courses/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a course if it is unused' })
  deleteCourse(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.dashboardCoursesService.deleteCourse(request.user, id);
  }

  @Get('class-courses')
  @ApiOperation({ summary: 'List class courses for a school year' })
  @ApiOkResponse({ type: DashboardClassCoursesResponseDto })
  listClassCourses(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardClassCoursesQueryDto,
  ): Promise<DashboardClassCoursesResponseDto> {
    return this.dashboardCoursesService.listClassCourses(request.user, query);
  }

  @Post('class-courses')
  @ApiOperation({ summary: 'Assign a course to a class for a year' })
  @ApiCreatedResponse({ type: DashboardClassCourseItemDto })
  createClassCourse(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardClassCourseDto,
  ): Promise<DashboardClassCourseItemDto> {
    return this.dashboardCoursesService.createClassCourse(request.user, dto);
  }

  @Get('class-courses/:id')
  @ApiOperation({ summary: 'Get a class course assignment' })
  @ApiOkResponse({ type: DashboardClassCourseItemDto })
  getClassCourse(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardClassCourseItemDto> {
    return this.dashboardCoursesService.getClassCourse(request.user, id);
  }

  @Patch('class-courses/:id')
  @ApiOperation({ summary: 'Update a class course assignment' })
  @ApiOkResponse({ type: DashboardClassCourseItemDto })
  updateClassCourse(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardClassCourseDto,
  ): Promise<DashboardClassCourseItemDto> {
    return this.dashboardCoursesService.updateClassCourse(
      request.user,
      id,
      dto,
    );
  }

  @Delete('class-courses/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a course from a class for a year' })
  deleteClassCourse(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.dashboardCoursesService.deleteClassCourse(request.user, id);
  }
}
