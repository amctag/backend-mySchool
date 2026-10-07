import { registerAs } from '@nestjs/config';

/** Teacher Flutter web app on EasyPanel. Browsers send this without a trailing slash. */
const TEACHER_WEB_ORIGIN = 'https://amctag-my-school-teacher.38f0fz.easypanel.host';
/** Teacher Flutter web app custom domain. */
const TEACHER_WEB_CUSTOM_ORIGIN = 'https://teacher.myschool-board.com';

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

  for (const defaultOrigin of [TEACHER_WEB_ORIGIN, TEACHER_WEB_CUSTOM_ORIGIN]) {
    if (!origins.includes(defaultOrigin)) {
      origins.push(defaultOrigin);
    }
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
