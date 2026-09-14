import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateDashboardAlbumDto } from './dto/create-dashboard-album.dto';
import { DashboardAlbumsService } from './dashboard-albums.service';

@ApiTags('Dashboard Albums v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard', version: '1' })
export class DashboardAlbumsController {
  constructor(private readonly dashboardAlbumsService: DashboardAlbumsService) {}

  @Post('albums')
  @ApiOperation({
    summary: 'Create a photo album',
    description:
      'Creates a published album and notifies parents and teachers of that academic year.',
  })
  @ApiCreatedResponse({ description: 'Album created' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  createAlbum(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardAlbumDto,
  ) {
    return this.dashboardAlbumsService.createAlbum(request.user, dto);
  }
}
