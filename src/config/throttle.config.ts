import { registerAs } from '@nestjs/config';

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? '', 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default registerAs('throttle', () => ({
  ttl: parsePositiveInt(process.env.THROTTLE_TTL, 60000),
  limit: parsePositiveInt(process.env.THROTTLE_LIMIT, 100),
  authTtl: parsePositiveInt(process.env.THROTTLE_AUTH_TTL, 60000),
  authLimit: parsePositiveInt(process.env.THROTTLE_AUTH_LIMIT, 5),
}));
