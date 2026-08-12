import { Controller, Get, Query, Req } from '@nestjs/common';
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
import { ParentNoticesQueryDto } from './dto/parent-notices-query.dto';
import { ParentNoticesResponseDto } from './dto/parent-notices-response.dto';
import { ParentService } from './parent.service';

@ApiTags('Parent Notices v1')
@Controller({ path: 'parent', version: '1' })
export class ParentNoticeController {
  constructor(private readonly parentService: ParentService) {}

  @Get('me/notices')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get notices for the logged-in parent children',
    description:
      'Returns active notices when the child is a direct recipient or belongs to a targeted section. ' +
      'Pass studentId to filter by one child, or omit for all relevant children. Supports page and limit pagination.',
  })
  @ApiOkResponse({ type: ParentNoticesResponseDto })
  @ApiNotFoundResponse({ description: 'Child not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getNotices(
    @Req() request: Request & { user: AuthenticatedParent },
    @Query() query: ParentNoticesQueryDto,
  ): Promise<ParentNoticesResponseDto> {
    return this.parentService.getNotices(
      request.user,
      query.studentId,
      query.page ?? 1,
      query.limit ?? 10,
    );
  }
}
