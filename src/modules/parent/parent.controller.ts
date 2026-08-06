import { Body, Controller, Get, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedParent } from '../../auth/interfaces/jwt-payload.interface';
import { Public } from '../../common/decorators/public.decorator';
import { ParentLoginResponseDto } from './dto/parent-login-response.dto';
import { ParentLoginDto } from './dto/parent-login.dto';
import { ParentLogoutResponseDto } from './dto/parent-logout-response.dto';
import { ParentMeChildDetailResponseDto } from './dto/parent-me-children-response.dto';
import { ParentMeChildrenSummaryResponseDto } from './dto/parent-me-children-summary-response.dto';
import { ParentMeResponseDto } from './dto/parent-me-response.dto';
import { ParentRefreshResponseDto } from './dto/parent-refresh-response.dto';
import { ParentRefreshDto } from './dto/parent-refresh.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent v1')
@Controller({ path: 'parent', version: '1' })
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ auth: {} })
  @Post('login')
  @ApiOperation({ summary: 'Parent login' })
  @ApiOkResponse({ type: ParentLoginResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid username or password' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts' })
  login(@Body() loginDto: ParentLoginDto): Promise<ParentLoginResponseDto> {
    return this.parentService.login(loginDto);
  }

  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ auth: {} })
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh parent access token' })
  @ApiOkResponse({ type: ParentRefreshResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  @ApiTooManyRequestsResponse({ description: 'Too many refresh attempts' })
  refresh(@Body() refreshDto: ParentRefreshDto): Promise<ParentRefreshResponseDto> {
    return this.parentService.refresh(refreshDto.refreshToken);
  }

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

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Parent logout' })
  @ApiOkResponse({ type: ParentLogoutResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  logout(
    @Req() request: Request & { user: AuthenticatedParent },
  ): Promise<ParentLogoutResponseDto> {
    return this.parentService.logout(request.user);
  }
}
