import { BadRequestException, Controller, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { MediaUploadService, UploadKind } from '../../upload/media-upload.service';
@Roles('director')
@Controller({ path: 'director', version: '1' })
export class DirectorUploadsController {
  constructor(private readonly mediaUpload: MediaUploadService) {}
  @Post('me/uploads')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }))
  async upload(@Req() request: { user: AuthenticatedDirector; body?: { kind?: string } }, @UploadedFile() file: { originalname: string; buffer: Buffer; mimetype: string } | undefined, @Query('kind') queryKind?: string) {
    if (!file?.buffer?.length) throw new BadRequestException('A file is required');
    const kind: UploadKind = (request.body?.kind ?? queryKind) === 'file' ? 'file' : 'image';
    return this.mediaUpload.upload(file, kind);
  }
}
