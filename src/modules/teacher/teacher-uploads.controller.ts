import {
  BadRequestException,
  Controller,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { TeacherAccessService } from './teacher-access.service';
import {
  TeacherUploadQueryDto,
  TeacherUploadResponseDto,
} from './dto/teacher-upload.dto';
import { MediaUploadService, UploadKind } from '../../upload/media-upload.service';

@ApiTags('Teacher Uploads v1')
@ApiBearerAuth()
@Roles('teacher')
@Controller({ path: 'teacher', version: '1' })
export class TeacherUploadsController {
  constructor(
    private readonly teacherAccess: TeacherAccessService,
    private readonly mediaUpload: MediaUploadService,
  ) {}

  @Post('me/uploads')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        kind: { type: 'string', enum: ['image', 'file'] },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload an agenda image or PDF',
    description:
      'Proxies the file to the school upload server. Returns a public URL to store on the agenda.',
  })
  @ApiCreatedResponse({ type: TeacherUploadResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  async upload(
    @Req() request: Request & { user: AuthenticatedTeacher },
    @UploadedFile() file: { originalname: string; buffer: Buffer; mimetype: string } | undefined,
    @Query() query: TeacherUploadQueryDto,
  ): Promise<TeacherUploadResponseDto> {
    this.teacherAccess.ensureTeacherRole(request.user);
    if (!file?.buffer?.length) {
      throw new BadRequestException('A file is required');
    }
    const kind: UploadKind =
      String(
        (request.body as { kind?: string } | undefined)?.kind ?? query.kind ?? '',
      ) === 'file'
        ? 'file'
        : 'image';
    return this.mediaUpload.upload(file, kind);
  }
}
