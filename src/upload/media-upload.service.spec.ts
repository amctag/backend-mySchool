import { ConfigService } from '@nestjs/config';
import {
  MediaUploadService,
  normalizePublicMediaUrl,
} from './media-upload.service';

describe('MediaUploadService', () => {
  const service = new MediaUploadService({
    get: () => '',
  } as unknown as ConfigService);

  const base = 'https://st79068.ispot.cc/myschool';

  it('maps image/x.jpg to /images/x.jpg', () => {
    expect(service.publicUrl(base, 'image/x.jpg', 'image')).toBe(
      `${base}/images/x.jpg`,
    );
  });

  it('maps video and voice folders', () => {
    expect(service.publicUrl(base, 'video/x.mp4', 'video')).toBe(
      `${base}/videos/x.mp4`,
    );
    expect(service.publicUrl(base, 'voice/x.m4a', 'voice')).toBe(
      `${base}/voice/x.m4a`,
    );
  });

  it('maps a PDF onto /documents/', () => {
    expect(service.publicUrl(base, 'document/notes.pdf', 'document')).toBe(
      `${base}/documents/notes.pdf`,
    );
    expect(service.publicUrl(base, 'notes.pdf', 'file')).toBe(
      `${base}/documents/notes.pdf`,
    );
  });

  it('rewrites stored PDF links from /images or /document to /documents', () => {
    expect(
      normalizePublicMediaUrl(
        `${base}/images/Amazon-SES-Email-Reputation-AR_1789366403_6fc76a984b09.pdf`,
      ),
    ).toBe(
      `${base}/documents/Amazon-SES-Email-Reputation-AR_1789366403_6fc76a984b09.pdf`,
    );
    expect(
      normalizePublicMediaUrl(`${base}/document/notes.pdf`),
    ).toBe(`${base}/documents/notes.pdf`);
    expect(normalizePublicMediaUrl(`${base}/images/photo.jpg`)).toBe(
      `${base}/images/photo.jpg`,
    );
  });
});
