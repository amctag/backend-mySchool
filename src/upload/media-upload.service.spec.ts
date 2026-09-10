import { ConfigService } from '@nestjs/config';
import { MediaUploadService } from './media-upload.service';

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

  it('maps a PDF onto the same /images/ route as photos', () => {
    expect(service.publicUrl(base, 'document/notes.pdf', 'document')).toBe(
      `${base}/images/notes.pdf`,
    );
    expect(service.publicUrl(base, 'notes.pdf', 'file')).toBe(
      `${base}/images/notes.pdf`,
    );
  });

  it('falls back to images when the path has no folder', () => {
    expect(service.publicUrl(base, 'notes.pdf', 'file')).toBe(
      `${base}/images/notes.pdf`,
    );
  });
});
