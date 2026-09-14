import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateDashboardAlbumDto } from './dto/create-dashboard-album.dto';
import { DashboardAlbumsQueryDto } from './dto/dashboard-albums-query.dto';
import {
  DashboardAlbumItemDto,
  DashboardAlbumsResponseDto,
} from './dto/dashboard-albums-response.dto';
import { DashboardAlbumsService } from './dashboard-albums.service';

@ApiTags('Dashboard Albums v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/albums', version: '1' })
export class DashboardAlbumsController {
  constructor(private readonly dashboardAlbumsService: DashboardAlbumsService) {}

  @Get()
  @ApiOperation({ summary: 'List photo albums' })
  @ApiOkResponse({ type: DashboardAlbumsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listAlbums(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardAlbumsQueryDto,
  ): Promise<DashboardAlbumsResponseDto> {
    return this.dashboardAlbumsService.listAlbums(request.user, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a photo album',
    description:
      'Creates a published album and notifies parents and teachers of that academic year.',
  })
  @ApiCreatedResponse({ type: DashboardAlbumItemDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  createAlbum(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardAlbumDto,
  ): Promise<DashboardAlbumItemDto> {
    return this.dashboardAlbumsService.createAlbum(request.user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one album' })
  @ApiOkResponse({ type: DashboardAlbumItemDto })
  @ApiNotFoundResponse({ description: 'Album not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getAlbum(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardAlbumItemDto> {
    return this.dashboardAlbumsService.getAlbum(request.user, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an album',
    description: 'Updates album details and photos. Parents and teachers are notified.',
  })
  @ApiOkResponse({ type: DashboardAlbumItemDto })
  @ApiNotFoundResponse({ description: 'Album not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  updateAlbum(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDashboardAlbumDto,
  ): Promise<DashboardAlbumItemDto> {
    return this.dashboardAlbumsService.updateAlbum(request.user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete an album' })
  @ApiNotFoundResponse({ description: 'Album not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  deleteAlbum(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.dashboardAlbumsService.deleteAlbum(request.user, id);
  }
}
