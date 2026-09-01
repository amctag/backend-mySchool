import {
  Body,
  Controller,
  Get,
  Param,
  ParseArrayPipe,
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
import { CreateDashboardGradeFormDto } from './dto/create-dashboard-grade-form.dto';
import { DashboardGradeFormClassesCoursesResponseDto } from './dto/dashboard-grade-form-classes-courses-response.dto';
import { DashboardGradeFormsQueryDto } from './dto/dashboard-grade-forms-query.dto';
import {
  DashboardGradeFormDetailDto,
  DashboardGradeFormsResponseDto,
} from './dto/dashboard-grade-forms-response.dto';
import { UpdateDashboardGradeFormClassesDto } from './dto/update-dashboard-grade-form-classes.dto';
import { DashboardGradeFormsService } from './dashboard-grade-forms.service';

@ApiTags('Dashboard Grade Forms v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/grade-forms', version: '1' })
export class DashboardGradeFormsController {
  constructor(
    private readonly dashboardGradeFormsService: DashboardGradeFormsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List grade forms' })
  @ApiOkResponse({ type: DashboardGradeFormsResponseDto })
  listGradeForms(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardGradeFormsQueryDto,
  ): Promise<DashboardGradeFormsResponseDto> {
    return this.dashboardGradeFormsService.listGradeForms(request.user, query);
  }

  @Get(':id/classes-courses')
  @ApiOperation({ summary: 'List classes and courses for a grade form' })
  @ApiOkResponse({ type: DashboardGradeFormClassesCoursesResponseDto })
  getGradeFormClassesCourses(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Query(
      'classIds',
      new ParseArrayPipe({ items: Number, separator: ',', optional: true }),
    )
    classIds?: number[],
  ): Promise<DashboardGradeFormClassesCoursesResponseDto> {
    return this.dashboardGradeFormsService.getGradeFormClassesCourses(
      request.user,
      id,
      classIds,
    );
  }

  @Patch(':id/classes')
  @ApiOperation({ summary: 'Update classes assigned to a grade form' })
  @ApiOkResponse({ type: DashboardGradeFormClassesCoursesResponseDto })
  updateGradeFormClasses(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateDashboardGradeFormClassesDto,
  ): Promise<DashboardGradeFormClassesCoursesResponseDto> {
    return this.dashboardGradeFormsService.updateGradeFormClasses(
      request.user,
      id,
      body,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a grade form' })
  @ApiOkResponse({ type: DashboardGradeFormDetailDto })
  getGradeForm(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardGradeFormDetailDto> {
    return this.dashboardGradeFormsService.getGradeForm(request.user, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a grade form' })
  @ApiCreatedResponse({ type: DashboardGradeFormDetailDto })
  createGradeForm(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() body: CreateDashboardGradeFormDto,
  ): Promise<DashboardGradeFormDetailDto> {
    return this.dashboardGradeFormsService.createGradeForm(request.user, body);
  }
}
