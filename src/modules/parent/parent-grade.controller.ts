import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedParent } from '../../auth/interfaces/jwt-payload.interface';
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
      'Only grades with publishDate on or before now are returned. Pass studentId to filter by one child.',
  })
  @ApiOkResponse({ type: ParentGradesResponseDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getGrades(
    @Req() request: Request & { user: AuthenticatedParent },
    @Query() query: ParentGradesQueryDto,
  ): Promise<ParentGradesResponseDto> {
    return this.parentService.getGrades(request.user, query.studentId);
  }
}
