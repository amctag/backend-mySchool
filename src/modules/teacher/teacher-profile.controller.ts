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
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { TeacherChangePasswordDto, TeacherChangePasswordResponseDto, TeacherMeResponseDto } from './dto/teacher-profile.dto';
import { TeacherAuthService } from './teacher-auth.service';

@ApiTags('Teacher Profile v1')
@ApiBearerAuth()
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherProfileController {
  constructor(private readonly teacherAuthService: TeacherAuthService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get logged-in teacher profile' })
  @ApiOkResponse({ type: TeacherMeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getProfile(
    @Req() request: Request & { user: AuthenticatedTeacher },
  ): Promise<TeacherMeResponseDto> {
    return this.teacherAuthService.getProfile(request.user);
  }

  @Post('me/change-password')
  @ApiOperation({
    summary: 'Change password using the current password',
    description:
      'Matches the teacher app change-password screen: current password plus new password confirmation.',
  })
  @ApiOkResponse({ type: TeacherChangePasswordResponseDto })
  @ApiBadRequestResponse({ description: 'Passwords do not match or validation failed' })
  @ApiUnauthorizedResponse({
    description: 'Missing token or invalid current password',
  })
  changePassword(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Body() dto: TeacherChangePasswordDto,
  ): Promise<TeacherChangePasswordResponseDto> {
    return this.teacherAuthService.changePassword(request.user, dto);
  }
}
