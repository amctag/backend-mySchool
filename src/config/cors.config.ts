import { registerAs } from '@nestjs/config';

/** Teacher Flutter web app on EasyPanel. Browsers send this without a trailing slash. */
const TEACHER_WEB_ORIGIN = 'https://amctag-my-school-teacher.38f0fz.easypanel.host';

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
}

export default registerAs('cors', () => {
  const origins = parseOrigins(process.env.CORS_ORIGINS);

  if (!origins.includes(TEACHER_WEB_ORIGIN)) {
    origins.push(TEACHER_WEB_ORIGIN);
  }

  const publicUrl = process.env.APP_PUBLIC_URL
    ? normalizeOrigin(process.env.APP_PUBLIC_URL)
    : '';
  if (publicUrl && !origins.includes(publicUrl)) {
    origins.push(publicUrl);
  }

  return {
    origins,
    allowLocalhost: process.env.CORS_ALLOW_LOCALHOST !== 'false',
    allowSameHost: process.env.CORS_ALLOW_SAME_HOST !== 'false',
  };
});
