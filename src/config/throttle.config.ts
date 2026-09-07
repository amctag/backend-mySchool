import { registerAs } from '@nestjs/config';

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? '', 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isThrottleDisabled(value: string | undefined): boolean {
  if (value === undefined || value === '') {
    return true;
  }

  return value === 'true' || value === '1';
}

export default registerAs('throttle', () => ({
  disabled: isThrottleDisabled(process.env.THROTTLE_DISABLED),
  ttl: parsePositiveInt(process.env.THROTTLE_TTL, 60000),
  limit: parsePositiveInt(process.env.THROTTLE_LIMIT, 10000),
  authTtl: parsePositiveInt(process.env.THROTTLE_AUTH_TTL, 60000),
  authLimit: parsePositiveInt(process.env.THROTTLE_AUTH_LIMIT, 30),
}));
