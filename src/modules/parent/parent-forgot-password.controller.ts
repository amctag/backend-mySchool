import { Body, Controller, Post } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ParentForgotPasswordRequestOtpDto } from './dto/parent-forgot-password-request-otp.dto';
import { ParentForgotPasswordRequestOtpResponseDto } from './dto/parent-forgot-password-request-otp-response.dto';
import { ParentForgotPasswordResetDto } from './dto/parent-forgot-password-reset.dto';
import { ParentForgotPasswordResetResponseDto } from './dto/parent-forgot-password-reset-response.dto';
import { ParentForgotPasswordVerifyOtpDto } from './dto/parent-forgot-password-verify-otp.dto';
import { ParentForgotPasswordVerifyOtpResponseDto } from './dto/parent-forgot-password-verify-otp-response.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Auth v1')
@Controller({ path: 'parent', version: '1' })
export class ParentForgotPasswordController {
  constructor(private readonly parentService: ParentService) {}

  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ auth: {} })
  @Post('forgot-password/request-otp')
  @ApiOperation({ summary: 'Request forgot-password OTP by username' })
  @ApiOkResponse({ type: ParentForgotPasswordRequestOtpResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiTooManyRequestsResponse({ description: 'Too many OTP requests' })
  @ApiResponse({ status: 503, description: 'Unable to send verification email' })
  requestForgotPasswordOtp(
    @Body() dto: ParentForgotPasswordRequestOtpDto,
  ): Promise<ParentForgotPasswordRequestOtpResponseDto> {
    return this.parentService.requestForgotPasswordOtp(dto);
  }

  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ auth: {} })
  @Post('forgot-password/verify-otp')
  @ApiOperation({ summary: 'Verify forgot-password OTP' })
  @ApiOkResponse({ type: ParentForgotPasswordVerifyOtpResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired verification code' })
  @ApiTooManyRequestsResponse({ description: 'Too many attempts' })
  verifyForgotPasswordOtp(
    @Body() dto: ParentForgotPasswordVerifyOtpDto,
  ): Promise<ParentForgotPasswordVerifyOtpResponseDto> {
    return this.parentService.verifyForgotPasswordOtp(dto);
  }

  @Public()
  @SkipThrottle({ default: true })
  @Throttle({ auth: {} })
  @Post('forgot-password/reset')
  @ApiOperation({ summary: 'Set a new password after OTP verification' })
  @ApiOkResponse({ type: ParentForgotPasswordResetResponseDto })
  @ApiBadRequestResponse({
    description: 'Passwords do not match or validation failed',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired reset token' })
  @ApiTooManyRequestsResponse({ description: 'Too many attempts' })
  resetForgotPassword(
    @Body() dto: ParentForgotPasswordResetDto,
  ): Promise<ParentForgotPasswordResetResponseDto> {
    return this.parentService.resetForgotPassword(dto);
  }
}
