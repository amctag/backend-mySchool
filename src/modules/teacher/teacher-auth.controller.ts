import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  TeacherFcmTokenDto,
  TeacherLoginDto,
  TeacherLoginResponseDto,
  TeacherLogoutResponseDto,
  TeacherRefreshDto,
  TeacherRefreshResponseDto,
} from './dto/teacher-auth.dto';
import { TeacherAuthService } from './teacher-auth.service';

@ApiTags('Teacher Auth v1')
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherAuthController {
  constructor(private readonly teacherAuthService: TeacherAuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Teacher login',
    description:
      'Authenticates a teacher by person ID or teacher ID and password. Optional fcmToken is stored for this device and does not remove other devices for the same person. Returns an access token and refresh token. Multiple devices can stay logged in at the same time. If the teacher belongs to multiple schools, pass schoolId to choose one; otherwise the first active school is used.',
  })
  @ApiOkResponse({ type: TeacherLoginResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid ID or password' })
  login(@Body() loginDto: TeacherLoginDto): Promise<TeacherLoginResponseDto> {
    return this.teacherAuthService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh teacher access token' })
  @ApiOkResponse({ type: TeacherRefreshResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  refresh(
    @Body() refreshDto: TeacherRefreshDto,
  ): Promise<TeacherRefreshResponseDto> {
    return this.teacherAuthService.refresh(refreshDto.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Teacher logout',
    description:
      'Ends only the current device session. Other logged-in devices stay signed in.',
  })
  @ApiOkResponse({ type: TeacherLogoutResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  logout(
    @Req() request: Request & { user: AuthenticatedTeacher },
  ): Promise<TeacherLogoutResponseDto> {
    return this.teacherAuthService.logout(request.user);
  }

  @Post('fcm-token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Save this device FCM token',
    description:
      'Stores the browser or phone token for the signed-in teacher without removing other devices.',
  })
  @ApiOkResponse({ schema: { example: { saved: true } } })
  saveFcmToken(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Body() body: TeacherFcmTokenDto,
  ): Promise<{ saved: true }> {
    return this.teacherAuthService.saveFcmToken(request.user, body.token);
  }
}
