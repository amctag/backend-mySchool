import { registerAs } from '@nestjs/config';

function trim(value: string | undefined): string {
  return (value ?? '').trim();
}

export default registerAs('upload', () => ({
  endpoint:
    trim(process.env.UPLOAD_ENDPOINT) ||
    'https://st79068.ispot.cc/myschool/upload.php',
  publicBase:
    trim(process.env.UPLOAD_PUBLIC_BASE) ||
    'https://st79068.ispot.cc/myschool',
  apiToken: trim(process.env.UPLOAD_API_TOKEN),
}));
