import { Body, Controller, Post, Get, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DirectorFcmTokenDto,
  DirectorLoginDto,
  DirectorLoginResponseDto,
  DirectorLogoutResponseDto,
  DirectorMeResponseDto,
  DirectorRefreshDto,
  DirectorRefreshResponseDto,
} from './dto/director-auth.dto';
import { DirectorAuthService } from './director-auth.service';

@ApiTags('Director Auth v1')
@Roles('director')
@Controller({ path: 'director', version: '1' })
export class DirectorAuthController {
  constructor(private readonly directorAuthService: DirectorAuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Director login',
    description:
      'Authenticates a director by person ID or director ID and password. Optional schoolId is used when the director belongs to more than one school. Returns an access token and refresh token.',
  })
  @ApiOkResponse({ type: DirectorLoginResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid ID or password' })
  login(@Body() loginDto: DirectorLoginDto): Promise<DirectorLoginResponseDto> {
    return this.directorAuthService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh director access token' })
  @ApiOkResponse({ type: DirectorRefreshResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  refresh(
    @Body() refreshDto: DirectorRefreshDto,
  ): Promise<DirectorRefreshResponseDto> {
    return this.directorAuthService.refresh(refreshDto.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Director logout',
    description:
      'Ends only the current device session. Other logged-in devices stay signed in.',
  })
  @ApiOkResponse({ type: DirectorLogoutResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  logout(
    @Req() request: Request & { user: AuthenticatedDirector },
  ): Promise<DirectorLogoutResponseDto> {
    return this.directorAuthService.logout(request.user);
  }

  @Post('fcm-token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Save this device FCM token',
    description:
      'Stores the browser or phone token for the signed-in director without removing other devices.',
  })
  @ApiOkResponse({ schema: { example: { saved: true } } })
  saveFcmToken(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Body() body: DirectorFcmTokenDto,
  ): Promise<{ saved: true }> {
    return this.directorAuthService.saveFcmToken(request.user, body.token);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get authenticated director profile',
    description:
      'Returns the authenticated director profile and selected school information.',
  })
  @ApiOkResponse({ type: DirectorMeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  async me(
    @Req() request: Request & { user: AuthenticatedDirector },
  ): Promise<DirectorMeResponseDto> {
    return this.directorAuthService.getProfile(request.user);
  }
}