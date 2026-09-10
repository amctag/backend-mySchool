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
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DashboardUploadQueryDto,
  DashboardUploadResponseDto,
} from './dto/dashboard-upload.dto';
import { MediaUploadService, UploadKind } from '../../upload/media-upload.service';

@ApiTags('Dashboard Uploads v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard', version: '1' })
export class DashboardUploadsController {
  constructor(private readonly mediaUpload: MediaUploadService) {}

  @Post('uploads')
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
  @ApiCreatedResponse({ type: DashboardUploadResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  async upload(
    @Req() request: Request & { user: AuthenticatedSchool },
    @UploadedFile()
    file: { originalname: string; buffer: Buffer; mimetype: string } | undefined,
    @Query() query: DashboardUploadQueryDto,
  ): Promise<DashboardUploadResponseDto> {
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
