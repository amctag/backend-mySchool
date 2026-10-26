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
  DirectorAnnouncementsQueryDto,
  DirectorAnnouncementItemDto,
  DirectorAnnouncementsResponseDto,
} from './dto/director-announcements.dto';
import { DirectorAnnouncementsService } from './director-announcements.service';

@ApiTags('Director Announcements v1')
@ApiBearerAuth()
@Roles('director')
@Controller({ path: 'director', version: '1' })
export class DirectorAnnouncementsController {
  constructor(private readonly directorAnnouncementsService: DirectorAnnouncementsService) {}

  @Get('me/announcements')
  @ApiOperation({
    summary: 'List announcements for director\'s school',
    description:
      'Returns announcements for the director\'s assigned school, filterable by date.',
  })
  @ApiOkResponse({ type: DirectorAnnouncementsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listAnnouncements(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Query() query: DirectorAnnouncementsQueryDto,
  ): Promise<DirectorAnnouncementsResponseDto> {
    return this.directorAnnouncementsService.listAnnouncements(request.user, query);
  }

  @Get('me/announcements/:id')
  @ApiOperation({
    summary: 'Get announcement by id for director\'s school',
    description: 'Returns a specific announcement by ID.',
  })
  @ApiOkResponse({ type: DirectorAnnouncementItemDto })
  @ApiForbiddenResponse({ description: 'Announcement not in director\'s school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getAnnouncement(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Param('id') announcementId: number,
  ): Promise<DirectorAnnouncementItemDto> {
    return this.directorAnnouncementsService.getAnnouncement(
      request.user,
      announcementId,
    );
  }

  @Post('me/announcements')
  @ApiOperation({
    summary: 'Create announcement for director\'s school',
    description: 'Creates a new announcement in the director\'s assigned school.',
  })
  @ApiCreatedResponse({ type: DirectorAnnouncementItemDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: 'Director cannot create announcements' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  createAnnouncement(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Body() dto: any,
  ): Promise<DirectorAnnouncementItemDto> {
    return this.directorAnnouncementsService.createAnnouncement(request.user, dto);
  }

  @Patch('me/announcements/:id')
  @ApiOperation({
    summary: 'Update announcement for director\'s school',
    description: 'Updates an existing announcement in the director\'s school.',
  })
  @ApiOkResponse({ type: DirectorAnnouncementItemDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: 'Announcement not in director\'s school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  updateAnnouncement(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Param('id') announcementId: number,
    @Body() dto: any,
  ): Promise<DirectorAnnouncementItemDto> {
    return this.directorAnnouncementsService.updateAnnouncement(
      request.user,
      announcementId,
      dto,
    );
  }

  @Delete('me/announcements/:id')
  @ApiOperation({
    summary: 'Delete announcement for director\'s school',
    description: 'Deletes an announcement from the director\'s school.',
  })
  @ApiOkResponse({ type: Boolean })
  @ApiForbiddenResponse({ description: 'Announcement not in director\'s school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  deleteAnnouncement(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Param('id') announcementId: number,
  ): Promise<boolean> {
    return this.directorAnnouncementsService.deleteAnnouncement(
      request.user,
      announcementId,
    );
  }
}