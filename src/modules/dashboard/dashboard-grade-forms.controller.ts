import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { DashboardGradeFormDetailsListResponseDto } from './dto/dashboard-grade-form-details-response.dto';
import { DashboardGradeFormByClassResponseDto } from './dto/dashboard-grade-form-by-class-response.dto';
import { DashboardGradeFormsQueryDto } from './dto/dashboard-grade-forms-query.dto';
import {
  DashboardGradeFormDetailDto,
  DashboardGradeFormsResponseDto,
} from './dto/dashboard-grade-forms-response.dto';
import { SaveDashboardGradeFormDetailDto } from './dto/save-dashboard-grade-form-detail.dto';
import { SaveDashboardGradeFormExpressionDto } from './dto/save-dashboard-grade-form-expression.dto';
import { UpdateDashboardGradeFormClassesDto } from './dto/update-dashboard-grade-form-classes.dto';
import { UpdateDashboardGradeFormDto } from './dto/update-dashboard-grade-form.dto';
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

  @Get('by-class')
  @ApiOperation({ summary: 'Get grade form and details for a class' })
  @ApiOkResponse({ type: DashboardGradeFormByClassResponseDto })
  getGradeFormByClass(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query('classId', ParseIntPipe) classId: number,
    @Query('yearId', ParseIntPipe) yearId: number,
  ): Promise<DashboardGradeFormByClassResponseDto> {
    return this.dashboardGradeFormsService.getGradeFormByClass(
      request.user,
      classId,
      yearId,
    );
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

  @Get(':id/details')
  @ApiOperation({ summary: 'List grade form details' })
  @ApiOkResponse({ type: DashboardGradeFormDetailsListResponseDto })
  listGradeFormDetails(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardGradeFormDetailsListResponseDto> {
    return this.dashboardGradeFormsService.listGradeFormDetails(
      request.user,
      id,
    );
  }

  @Post(':id/details')
  @ApiOperation({ summary: 'Create a grade form detail' })
  @ApiOkResponse({ type: DashboardGradeFormDetailsListResponseDto })
  createGradeFormDetail(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SaveDashboardGradeFormDetailDto,
  ): Promise<DashboardGradeFormDetailsListResponseDto> {
    return this.dashboardGradeFormsService.createGradeFormDetail(
      request.user,
      id,
      body,
    );
  }

  @Patch(':id/details/:detailId')
  @ApiOperation({ summary: 'Update a grade form detail' })
  @ApiOkResponse({ type: DashboardGradeFormDetailsListResponseDto })
  updateGradeFormDetail(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() body: SaveDashboardGradeFormDetailDto,
  ): Promise<DashboardGradeFormDetailsListResponseDto> {
    return this.dashboardGradeFormsService.updateGradeFormDetail(
      request.user,
      id,
      detailId,
      body,
    );
  }

  @Delete(':id/details/:detailId')
  @ApiOperation({ summary: 'Delete a grade form detail' })
  @ApiOkResponse({ type: DashboardGradeFormDetailsListResponseDto })
  deleteGradeFormDetail(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Param('detailId', ParseIntPipe) detailId: number,
  ): Promise<DashboardGradeFormDetailsListResponseDto> {
    return this.dashboardGradeFormsService.deleteGradeFormDetail(
      request.user,
      id,
      detailId,
    );
  }

  @Post(':id/details/:detailId/percentages')
  @ApiOperation({ summary: 'Add a related grade type to a detail expression' })
  @ApiOkResponse({ type: DashboardGradeFormDetailsListResponseDto })
  createGradeFormExpression(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() body: SaveDashboardGradeFormExpressionDto,
  ): Promise<DashboardGradeFormDetailsListResponseDto> {
    return this.dashboardGradeFormsService.createGradeFormExpression(
      request.user,
      id,
      detailId,
      body,
    );
  }

  @Delete(':id/details/:detailId/percentages/:percentageId')
  @ApiOperation({ summary: 'Remove a related grade type from a detail expression' })
  @ApiOkResponse({ type: DashboardGradeFormDetailsListResponseDto })
  deleteGradeFormExpression(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Param('detailId', ParseIntPipe) detailId: number,
    @Param('percentageId', ParseIntPipe) percentageId: number,
  ): Promise<DashboardGradeFormDetailsListResponseDto> {
    return this.dashboardGradeFormsService.deleteGradeFormExpression(
      request.user,
      id,
      detailId,
      percentageId,
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

  @Patch(':id')
  @ApiOperation({ summary: 'Update a grade form' })
  @ApiOkResponse({ type: DashboardGradeFormDetailDto })
  updateGradeForm(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateDashboardGradeFormDto,
  ): Promise<DashboardGradeFormDetailDto> {
    return this.dashboardGradeFormsService.updateGradeForm(
      request.user,
      id,
      body,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a grade form' })
  deleteGradeForm(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.dashboardGradeFormsService.deleteGradeForm(request.user, id);
  }
}
