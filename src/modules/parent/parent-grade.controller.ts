import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedParent } from '../../auth/interfaces/jwt-payload.interface';
import { DashboardGradeCardResponseDto } from '../dashboard/dto/dashboard-grade-card-response.dto';
import { ParentGradeCardQueryDto } from './dto/parent-grade-card-query.dto';
import { ParentGradesQueryDto } from './dto/parent-grades-query.dto';
import { ParentGradesResponseDto } from './dto/parent-grades-response.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Grades v1')
@Controller({ path: 'parent', version: '1' })
export class ParentGradeController {
  constructor(private readonly parentService: ParentService) {}

  @Get('me/grades')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get published grades for the parent children',
    description:
      'Returns published grade sheets for each child school, section, and registration. ' +
      'Only grades with publishDate on or before now are returned. Pass studentId and/or registrationId to filter.',
  })
  @ApiOkResponse({ type: ParentGradesResponseDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getGrades(
    @Req() request: Request & { user: AuthenticatedParent },
    @Query() query: ParentGradesQueryDto,
  ): Promise<ParentGradesResponseDto> {
    return this.parentService.getGrades(
      request.user,
      query.studentId,
      query.registrationId,
    );
  }

  @Get('me/grades/grade-card')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get export-style grade card for one child registration',
    description:
      'Same payload as the school export grade card, but only for registrations ' +
      'belonging to the authenticated parent’s children.',
  })
  @ApiOkResponse({ type: DashboardGradeCardResponseDto })
  @ApiBadRequestResponse({ description: 'Registration does not match filters' })
  @ApiNotFoundResponse({ description: 'Registration not found for this parent' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getGradeCard(
    @Req() request: Request & { user: AuthenticatedParent },
    @Query() query: ParentGradeCardQueryDto,
  ): Promise<DashboardGradeCardResponseDto> {
    return this.parentService.getGradeCard(request.user, query);
  }
}
