import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { SchoolRefreshCookieService } from '../../auth/cookies/school-refresh-cookie.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SchoolAccessTokenResponseDto } from './dto/school-access-token-response.dto';
import { SchoolLoginDto } from './dto/school-login.dto';
import { SchoolLogoutResponseDto } from './dto/school-logout-response.dto';
import { SchoolMeResponseDto } from './dto/school-me-response.dto';
import { SchoolAuthService } from './school-auth.service';

@ApiTags('School Auth v1')
@Roles('school')
@Controller({ path: 'school', version: '1' })
export class SchoolAuthController {
  constructor(
    private readonly schoolAuthService: SchoolAuthService,
    private readonly schoolRefreshCookieService: SchoolRefreshCookieService,
  ) {}

  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ auth: {} })
  @Post('login')
  @ApiOperation({ summary: 'School admin login' })
  @ApiOkResponse({ type: SchoolAccessTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(
    @Body() loginDto: SchoolLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SchoolAccessTokenResponseDto> {
    const result = await this.schoolAuthService.login(loginDto);

    this.schoolRefreshCookieService.set(
      response,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );

    return result.access;
  }

  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ auth: {} })
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh school admin access token' })
  @ApiOkResponse({ type: SchoolAccessTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SchoolAccessTokenResponseDto> {
    const result = await this.schoolAuthService.refresh(
      this.schoolRefreshCookieService.read(request),
    );

    this.schoolRefreshCookieService.set(
      response,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );

    return result.access;
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'School admin logout' })
  @ApiOkResponse({ type: SchoolLogoutResponseDto })
  async logout(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Res({ passthrough: true }) response: Response,
  ): Promise<SchoolLogoutResponseDto> {
    await this.schoolAuthService.logout(request.user);
    this.schoolRefreshCookieService.clear(response);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get logged-in school admin profile' })
  @ApiOkResponse({ type: SchoolMeResponseDto })
  getProfile(
    @Req() request: Request & { user: AuthenticatedSchool },
  ): Promise<SchoolMeResponseDto> {
    return this.schoolAuthService.getProfile(request.user);
  }
}
