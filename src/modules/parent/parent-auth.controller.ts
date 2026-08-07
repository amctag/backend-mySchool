import { Body, Controller, Post, Req } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { ParentRefreshResponseDto } from './dto/parent-refresh-response.dto';
import { ParentRefreshDto } from './dto/parent-refresh.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Auth v1')
@Controller({ path: 'parent', version: '1' })
export class ParentAuthController {
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
