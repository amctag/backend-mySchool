import { registerAs } from '@nestjs/config';

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  name: process.env.APP_NAME ?? 'my-school',
  /** Public dashboard origin for parent grade-card WebView links. */
  gradeCardBaseUrl: process.env.GRADE_CARD_BASE_URL?.trim()
    ? withoutTrailingSlash(process.env.GRADE_CARD_BASE_URL.trim())
    : null,
}));
