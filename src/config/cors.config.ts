import { registerAs } from '@nestjs/config';

function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export default registerAs('cors', () => {
  const origins = parseOrigins(process.env.CORS_ORIGINS);

  const publicUrl = process.env.APP_PUBLIC_URL?.trim();
  if (publicUrl && !origins.includes(publicUrl)) {
    origins.push(publicUrl);
  }

  return {
    origins,
    allowLocalhost: process.env.CORS_ALLOW_LOCALHOST !== 'false',
    allowSameHost: process.env.CORS_ALLOW_SAME_HOST !== 'false',
  };
});
