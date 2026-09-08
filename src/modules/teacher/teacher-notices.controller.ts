import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { TeacherMessageResponseDto } from './dto/teacher-auth.dto';
import {
  TeacherNoticeItemDto,
  TeacherNoticesQueryDto,
  TeacherNoticesResponseDto,
  UpsertTeacherNoticeDto,
} from './dto/teacher-notices.dto';
import { TeacherNoticesService } from './teacher-notices.service';

@ApiTags('Teacher Notices v1')
@ApiBearerAuth()
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherNoticesController {
  constructor(private readonly teacherNoticesService: TeacherNoticesService) {}

  @Get('me/notices')
  @ApiOperation({
    summary: 'List my notices',
    description:
      'Notices created by the logged-in teacher. Optional classId filters by assigned section.',
  })
  @ApiOkResponse({ type: TeacherNoticesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listNotices(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Query() query: TeacherNoticesQueryDto,
  ): Promise<TeacherNoticesResponseDto> {
    return this.teacherNoticesService.listNotices(request.user, query);
  }

  @Post('me/notices')
  @ApiOperation({
    summary: 'Create a notice',
    description:
      'Creates a notice for an assigned class (section) or one student in that class. Parents of targeted students get an FCM push when FCM is configured.',
  })
  @ApiCreatedResponse({ type: TeacherNoticeItemDto })
  @ApiBadRequestResponse({
    description: 'Validation failed or student is not in this class',
  })
  @ApiForbiddenResponse({ description: 'Teacher is not assigned to this class' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  createNotice(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Body() dto: UpsertTeacherNoticeDto,
  ): Promise<TeacherNoticeItemDto> {
    return this.teacherNoticesService.createNotice(request.user, dto);
  }

  @Get('me/notices/:noticeId')
  @ApiOperation({ summary: 'Get one of my notices' })
  @ApiOkResponse({ type: TeacherNoticeItemDto })
  @ApiNotFoundResponse({ description: 'Notice not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getNotice(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('noticeId', ParseIntPipe) noticeId: number,
  ): Promise<TeacherNoticeItemDto> {
    return this.teacherNoticesService.getNotice(request.user, noticeId);
  }

  @Patch('me/notices/:noticeId')
  @ApiOperation({
    summary: 'Update a notice',
    description: 'Updates a notice the logged-in teacher created.',
  })
  @ApiOkResponse({ type: TeacherNoticeItemDto })
  @ApiBadRequestResponse({
    description: 'Validation failed or student is not in this class',
  })
  @ApiForbiddenResponse({ description: 'Teacher is not assigned to this class' })
  @ApiNotFoundResponse({ description: 'Notice not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  updateNotice(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('noticeId', ParseIntPipe) noticeId: number,
    @Body() dto: UpsertTeacherNoticeDto,
  ): Promise<TeacherNoticeItemDto> {
    return this.teacherNoticesService.updateNotice(
      request.user,
      noticeId,
      dto,
    );
  }

  @Delete('me/notices/:noticeId')
  @ApiOperation({
    summary: 'Delete a notice',
    description: 'Soft-deletes a notice the logged-in teacher created.',
  })
  @ApiOkResponse({ type: TeacherMessageResponseDto })
  @ApiNotFoundResponse({ description: 'Notice not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  deleteNotice(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @Param('noticeId', ParseIntPipe) noticeId: number,
  ): Promise<TeacherMessageResponseDto> {
    return this.teacherNoticesService.deleteNotice(request.user, noticeId);
  }
}
