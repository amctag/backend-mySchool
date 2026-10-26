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
  TeacherAlbumsQueryDto,
  TeacherAlbumItemDto,
  TeacherAlbumsResponseDto,
} from './dto/director-albums.dto';
import { DirectorAlbumsService } from './director-albums.service';

@ApiTags('Director Albums v1')
@ApiBearerAuth()
@Roles('director')
@Controller({ path: 'director', version: '1' })
export class DirectorAlbumsController {
  constructor(private readonly directorAlbumsService: DirectorAlbumsService) {}

  @Get('me/albums')
  @ApiOperation({
    summary: 'List albums for directors school',
    description: 'Returns albums for the directors assigned school, filterable by date.',
  })
  @ApiOkResponse({ type: TeacherAlbumsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listAlbums(
    @Req() request: { user: AuthenticatedDirector },
    @Query() query: TeacherAlbumsQueryDto,
  ): Promise<TeacherAlbumsResponseDto> {
    return this.directorAlbumsService.listAlbums(request.user, query);
  }

  @Get('me/albums/:id')
  @ApiOperation({
    summary: 'Get album by id for directors school',
    description: 'Returns a specific album by ID.',
  })
  @ApiOkResponse({ type: TeacherAlbumItemDto })
  @ApiForbiddenResponse({ description: 'Album not in directors school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getAlbum(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') albumId: number,
  ): Promise<TeacherAlbumItemDto> {
    return this.directorAlbumsService.getAlbum(request.user, albumId);
  }

  @Post('me/albums')
  @ApiOperation({
    summary: 'Create album for directors school',
    description: 'Creates a new album in the directors assigned school.',
  })
  @ApiCreatedResponse({ type: TeacherAlbumItemDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: 'Director cannot create albums' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  createAlbum(
    @Req() request: { user: AuthenticatedDirector },
    @Body() dto: any,
  ): Promise<TeacherAlbumItemDto> {
    return this.directorAlbumsService.createAlbum(request.user, dto);
  }

  @Patch('me/albums/:id')
  @ApiOperation({
    summary: 'Update album for directors school',
    description: 'Updates an existing album in the directors school.',
  })
  @ApiOkResponse({ type: TeacherAlbumItemDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiForbiddenResponse({ description: 'Album not in directors school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  updateAlbum(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') albumId: number,
    @Body() dto: any,
  ): Promise<TeacherAlbumItemDto> {
    return this.directorAlbumsService.updateAlbum(request.user, albumId, dto);
  }

  @Delete('me/albums/:id')
  @ApiOperation({
    summary: 'Delete album for directors school',
    description: 'Deletes an album from the directors school.',
  })
  @ApiOkResponse({ type: Boolean })
  @ApiForbiddenResponse({ description: 'Album not in directors school' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  deleteAlbum(
    @Req() request: { user: AuthenticatedDirector },
    @Param('id') albumId: number,
  ): Promise<boolean> {
    return this.directorAlbumsService.deleteAlbum(request.user, albumId);
  }
}