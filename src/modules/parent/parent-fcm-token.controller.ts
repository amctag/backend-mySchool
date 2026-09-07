import { Body, Controller, Post, Put, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedParent } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ParentFcmTokenResponseDto,
  UpsertParentFcmTokenDto,
} from './dto/parent-fcm-token.dto';
import {
  SendParentFcmTestDto,
  SendParentFcmTestResponseDto,
} from './dto/parent-fcm-test.dto';
import { ParentFcmTokenService } from './parent-fcm-token.service';

@ApiTags('Parent Profile v1')
@Roles('parent')
@Controller({ path: 'parent', version: '1' })
export class ParentFcmTokenController {
  constructor(private readonly fcmTokenService: ParentFcmTokenService) {}

  @Put('me/fcm-token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Save the logged-in parent FCM device token',
    description:
      'Stores one FCM token per person. A second save for the same parent replaces the previous token.',
  })
  @ApiOkResponse({ type: ParentFcmTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  upsert(
    @Req() request: Request & { user: AuthenticatedParent },
    @Body() body: UpsertParentFcmTokenDto,
  ): Promise<ParentFcmTokenResponseDto> {
    return this.fcmTokenService.upsert(request.user, body.token);
  }

  @Post('me/fcm/test')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send a test FCM notification to this parent',
    description:
      'Sends a test push to the FCM token stored for the logged-in parent.',
  })
  @ApiOkResponse({ type: SendParentFcmTestResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  sendTest(
    @Req() request: Request & { user: AuthenticatedParent },
    @Body() body: SendParentFcmTestDto,
  ): Promise<SendParentFcmTestResponseDto> {
    return this.fcmTokenService.sendTest(request.user, body);
  }
}
