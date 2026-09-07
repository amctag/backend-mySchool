import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedParent } from '../../auth/interfaces/jwt-payload.interface';
import { ParentChangePasswordRequestOtpResponseDto } from './dto/parent-change-password-request-otp-response.dto';
import { ParentChangePasswordResponseDto } from './dto/parent-change-password-response.dto';
import { ParentChangePasswordDto } from './dto/parent-change-password.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Profile v1')
@Controller({ path: 'parent', version: '1' })
export class ParentPasswordController {
  constructor(private readonly parentService: ParentService) {}

  @Post('me/change-password/request-otp')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send email OTP to change password' })
  @ApiOkResponse({ type: ParentChangePasswordRequestOtpResponseDto })
  @ApiBadRequestResponse({ description: 'Email not found on account' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  @ApiResponse({ status: 503, description: 'Unable to send verification email' })
  requestChangePasswordOtp(
    @Req() request: Request & { user: AuthenticatedParent },
  ): Promise<ParentChangePasswordRequestOtpResponseDto> {
    return this.parentService.requestChangePasswordOtp(request.user);
  }

  @Post('me/change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password using email OTP' })
  @ApiOkResponse({ type: ParentChangePasswordResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid OTP, passwords do not match, or validation failed',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired token, or invalid OTP',
  })
  changePassword(
    @Req() request: Request & { user: AuthenticatedParent },
    @Body() changePasswordDto: ParentChangePasswordDto,
  ): Promise<ParentChangePasswordResponseDto> {
    return this.parentService.changePassword(request.user, changePasswordDto);
  }
}
