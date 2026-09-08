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
      'Authenticates a teacher by username and password. Optional fcmToken is stored when sent (one row per person). Returns an access token and refresh token. If the teacher belongs to multiple schools, pass schoolId to choose one; otherwise the first active school is used.',
  })
  @ApiOkResponse({ type: TeacherLoginResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid username or password' })
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
  @ApiOperation({ summary: 'Teacher logout' })
  @ApiOkResponse({ type: TeacherLogoutResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  logout(
    @Req() request: Request & { user: AuthenticatedTeacher },
  ): Promise<TeacherLogoutResponseDto> {
    return this.teacherAuthService.logout(request.user);
  }
}
