import {
  Body,
  Controller,
  Delete,
  Post,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DirectorNoticesQueryDto,
  DirectorNoticeItemDto,
  DirectorNoticesResponseDto,
  DirectorUpsertNoticeDto,
} from './dto/director-notices.dto';
import { DirectorNoticesService } from './director-notices.service';

@ApiTags('Director Notices v1')
@ApiBearerAuth()
@Roles('director')
@Controller({ path: 'director', version: '1' })
export class DirectorNoticesController {
  constructor(
    private readonly directorNoticesService: DirectorNoticesService,
  ) {}

  @Get('me/notices')
  @ApiOperation({
    summary: 'List notices for directors school',
    description:
      'Returns notices for the directors assigned school, filterable by date.',
  })
  @ApiOkResponse({ type: DirectorNoticesResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired token',
  })
  listNotices(
    @Req() request: { user: AuthenticatedDirector },
    @Query() query: DirectorNoticesQueryDto,
  ): Promise<DirectorNoticesResponseDto> {
    return this.directorNoticesService.listNotices(request.user, query);
  }

  @Get('me/notices/:id')
  @ApiOperation({
    summary: 'Get notice by id for directors school',
    description: 'Returns a specific notice by ID.',
  })
  @ApiOkResponse({ type: DirectorNoticeItemDto })
  @ApiForbiddenResponse({ description: 'Notice not in directors school' })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired token',
  })
  getNotice(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') noticeId: number,
  ): Promise<DirectorNoticeItemDto> {
    return this.directorNoticesService.getNotice(request.user, noticeId);
  }

  @Post('me/notices')
  @ApiOperation({
    summary: 'Create notice for directors school',
    description: 'Creates a new notice in the directors assigned school.',
  })
  @ApiCreatedResponse({ type: DirectorNoticeItemDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: 'Director cannot create notices' })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired token',
  })
  createNotice(
    @Req() request: { user: AuthenticatedDirector },
    @Body() dto: DirectorUpsertNoticeDto,
  ): Promise<DirectorNoticeItemDto> {
    return this.directorNoticesService.createNotice(request.user, dto);
  }

  @Patch('me/notices/:id')
  @ApiOperation({
    summary: 'Update notice for directors school',
    description: 'Updates an existing notice in the directors school.',
  })
  @ApiOkResponse({ type: DirectorNoticeItemDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: 'Notice not in directors school' })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired token',
  })
  updateNotice(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') noticeId: number,
    @Body() dto: any,
  ): Promise<DirectorNoticeItemDto> {
    return this.directorNoticesService.updateNotice(
      request.user,
      noticeId,
      dto,
    );
  }

  @Delete('me/notices/:id')
  @ApiOperation({
    summary: 'Delete notice for directors school',
    description: 'Deletes a notice from the directors school.',
  })
  @ApiOkResponse({ type: Boolean })
  @ApiForbiddenResponse({ description: 'Notice not in directors school' })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired token',
  })
  deleteNotice(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') noticeId: number,
  ): Promise<boolean> {
    return this.directorNoticesService.deleteNotice(request.user, noticeId);
  }
}
