import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ParentLoginResponseDto } from './dto/parent-login-response.dto';
import { ParentLoginDto } from './dto/parent-login.dto';
import { ParentLogoutResponseDto } from './dto/parent-logout-response.dto';
import { ParentMeResponseDto } from './dto/parent-me-response.dto';
import { ParentRefreshResponseDto } from './dto/parent-refresh-response.dto';
import { ParentRefreshDto } from './dto/parent-refresh.dto';
import { AuthenticatedParent } from './interfaces/jwt-payload.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('parent/login')
  @ApiOperation({ summary: 'Parent login' })
  @ApiOkResponse({ type: ParentLoginResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid username or password' })
  parentLogin(@Body() loginDto: ParentLoginDto): Promise<ParentLoginResponseDto> {
    return this.authService.parentLogin(loginDto);
  }

  @Public()
  @Post('parent/refresh')
  @ApiOperation({ summary: 'Refresh parent access token' })
  @ApiOkResponse({ type: ParentRefreshResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  parentRefresh(
    @Body() refreshDto: ParentRefreshDto,
  ): Promise<ParentRefreshResponseDto> {
    return this.authService.parentRefresh(refreshDto.refreshToken);
  }

  @Get('parent/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get logged-in parent profile' })
  @ApiOkResponse({ type: ParentMeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  parentMe(
    @Req() request: Request & { user: AuthenticatedParent },
  ): Promise<ParentMeResponseDto> {
    return this.authService.parentMe(request.user);
  }

  @Post('parent/logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Parent logout' })
  @ApiOkResponse({ type: ParentLogoutResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  parentLogout(
    @Req() request: Request & { user: AuthenticatedParent },
  ): Promise<ParentLogoutResponseDto> {
    return this.authService.parentLogout(request.user);
  }
}
