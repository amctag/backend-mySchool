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
import { AuthenticatedParent } from '../../auth/interfaces/jwt-payload.interface';
import {
  ParentAlbumDetailQueryDto,
  ParentAlbumsQueryDto,
} from './dto/parent-albums-query.dto';
import {
  ParentAlbumDetailResponseDto,
  ParentAlbumsResponseDto,
} from './dto/parent-albums-response.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Albums v1')
@Controller({ path: 'parent', version: '1' })
export class ParentAlbumController {
  constructor(private readonly parentService: ParentService) {}

  @Get('me/albums')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get photo albums grouped by school for the parent children',
    description:
      'Returns active albums for each school linked to the parent children. ' +
      'Pass studentId to filter by one child school, or omit for all relevant schools.',
  })
  @ApiOkResponse({ type: ParentAlbumsResponseDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getAlbums(
    @Req() request: Request & { user: AuthenticatedParent },
    @Query() query: ParentAlbumsQueryDto,
  ): Promise<ParentAlbumsResponseDto> {
    return this.parentService.getAlbums(request.user, query.studentId);
  }

  @Get('me/albums/:albumId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get one photo album with all images',
    description:
      'Returns a single album when it belongs to a school linked to the parent children.',
  })
  @ApiOkResponse({ type: ParentAlbumDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Album or child not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getAlbumById(
    @Req() request: Request & { user: AuthenticatedParent },
    @Param('albumId', ParseIntPipe) albumId: number,
    @Query() query: ParentAlbumDetailQueryDto,
  ): Promise<ParentAlbumDetailResponseDto> {
    return this.parentService.getAlbumById(
      request.user,
      albumId,
      query.studentId,
    );
  }
}
