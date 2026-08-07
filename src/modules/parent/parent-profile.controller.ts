import { Controller, Get, Param, ParseIntPipe, Req } from '@nestjs/common';
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
import { ParentMeChildDetailResponseDto } from './dto/parent-me-children-response.dto';
import { ParentMeChildrenSummaryResponseDto } from './dto/parent-me-children-summary-response.dto';
import { ParentMeResponseDto } from './dto/parent-me-response.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Profile v1')
@Controller({ path: 'parent', version: '1' })
export class ParentProfileController {
  constructor(private readonly parentService: ParentService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get logged-in parent profile' })
  @ApiOkResponse({ type: ParentMeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getProfile(
    @Req() request: Request & { user: AuthenticatedParent },
  ): Promise<ParentMeResponseDto> {
    return this.parentService.getProfile(request.user);
  }

  @Get('me/children')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get parent children names and years' })
  @ApiOkResponse({ type: ParentMeChildrenSummaryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getChildrenSummary(
    @Req() request: Request & { user: AuthenticatedParent },
  ): Promise<ParentMeChildrenSummaryResponseDto> {
    return this.parentService.getChildrenSummary(request.user);
  }

  @Get('me/children/:studentId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get full child information' })
  @ApiOkResponse({ type: ParentMeChildDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getChildDetail(
    @Req() request: Request & { user: AuthenticatedParent },
    @Param('studentId', ParseIntPipe) studentId: number,
  ): Promise<ParentMeChildDetailResponseDto> {
    return this.parentService.getChildDetail(request.user, studentId);
  }
}
