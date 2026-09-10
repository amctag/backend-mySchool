import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type UploadKind = 'image' | 'file';

const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

@Injectable()
export class MediaUploadService {
  constructor(private readonly configService: ConfigService) {}

  async upload(
    file: { originalname: string; buffer: Buffer; mimetype?: string },
    kind: UploadKind,
  ): Promise<{ url: string; path: string; category: string }> {
    const endpoint = this.configService.get<string>('upload.endpoint') ?? '';
    const publicBase = (
      this.configService.get<string>('upload.publicBase') ?? ''
    ).replace(/\/$/, '');
    const apiToken = this.configService.get<string>('upload.apiToken') ?? '';

    if (!endpoint || !publicBase || !apiToken) {
      throw new ServiceUnavailableException(
        'File upload is not configured. Set UPLOAD_ENDPOINT, UPLOAD_PUBLIC_BASE, and UPLOAD_API_TOKEN.',
      );
    }

    const filename = file.originalname || 'upload.bin';
    const mime = this.mimeFor(filename, kind, file.mimetype);

    const form = new FormData();
    form.append('token', apiToken);
    form.append('folder', 'images');
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: mime }),
      filename,
    );

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}` },
        body: form,
      });
    } catch {
      throw new BadGatewayException('Could not reach the upload server');
    }

    const raw = await response.text();
    let decoded: unknown;
    try {
      decoded = raw ? JSON.parse(raw) : null;
    } catch {
      throw new BadGatewayException('Upload server returned an invalid response');
    }

    if (!response.ok) {
      throw new BadGatewayException(
        this.messageFrom(decoded) || `Upload failed (${response.status})`,
      );
    }

    const payload = decoded as {
      success?: boolean;
      path?: string;
      category?: string;
      message?: string;
    };
    if (!payload?.success || !payload.path) {
      throw new BadGatewayException(
        payload?.message || 'Upload server rejected the file',
      );
    }

    const category = kind === 'file' ? 'image' : payload.category || kind;
    return {
      url: this.publicUrl(publicBase, payload.path, category),
      path: payload.path,
      category,
    };
  }

  publicUrl(publicBase: string, path: string, category: string): string {
    const base = publicBase.replace(/\/$/, '');
    const fileName = path.split('/').filter(Boolean).pop() ?? path;
    const folder = this.publicFolder(category, path);
    return `${base}/${folder}/${fileName}`;
  }

  private publicFolder(category: string, path: string): string {
    const normalized = category.trim().toLowerCase();
    if (normalized === 'image' || normalized === 'images') {
      return 'images';
    }
    if (normalized === 'video' || normalized === 'videos') {
      return 'videos';
    }
    if (normalized === 'voice' || normalized === 'voices') {
      return 'voice';
    }
    if (
      normalized === 'file' ||
      normalized === 'document' ||
      normalized === 'documents'
    ) {
      return 'images';
    }
    const parts = path.split('/').filter(Boolean);
    const prefix = parts.length > 1 ? parts[0].toLowerCase() : '';
    if (prefix === 'image' || prefix === 'images') {
      return 'images';
    }
    if (prefix === 'video' || prefix === 'videos') {
      return 'videos';
    }
    if (prefix === 'voice' || prefix === 'voices') {
      return 'voice';
    }
    if (prefix === 'document' || prefix === 'documents' || prefix === 'file') {
      return 'images';
    }
    return prefix || 'images';
  }

  private mimeFor(
    filename: string,
    kind: UploadKind,
    reported?: string,
  ): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (kind === 'image') {
      const mime = IMAGE_MIME[ext];
      if (!mime) {
        throw new BadRequestException(
          'Please upload a JPG, PNG, WEBP, or GIF image',
        );
      }
      return mime;
    }
    if (ext !== 'pdf') {
      throw new BadRequestException('Please upload a PDF file');
    }
    return reported === 'application/pdf' ? reported : 'application/pdf';
  }

  private messageFrom(decoded: unknown): string | null {
    if (!decoded || typeof decoded !== 'object') {
      return null;
    }
    const message = (decoded as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() ? message : null;
  }
}
