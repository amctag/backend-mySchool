import { Controller, Get, Param, ParseIntPipe, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  TeacherAlbumItemDto,
  TeacherAlbumsQueryDto,
  TeacherAlbumsResponseDto,
} from './dto/teacher-media.dto';
import { TeacherAlbumsService } from './teacher-albums.service';

@ApiTags('Teacher Albums v1')
@ApiBearerAuth()
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherAlbumsController {
  constructor(private readonly teacherAlbumsService: TeacherAlbumsService) {}

  @Get('me/albums')
  @ApiOperation({
    summary: 'List albums for me',
    description: 'Published photo albums for academic years I teach.',
  })
  @ApiOkResponse({ type: TeacherAlbumsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listAlbums(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Query() query: TeacherAlbumsQueryDto,
  ): Promise<TeacherAlbumsResponseDto> {
    return this.teacherAlbumsService.listAlbums(request.user, query);
  }

  @Get('me/albums/:albumId')
  @ApiOperation({ summary: 'Get one album for me' })
  @ApiOkResponse({ type: TeacherAlbumItemDto })
  @ApiNotFoundResponse({ description: 'Album not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getAlbum(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('albumId', ParseIntPipe) albumId: number,
  ): Promise<TeacherAlbumItemDto> {
    return this.teacherAlbumsService.getAlbum(request.user, albumId);
  }
}
