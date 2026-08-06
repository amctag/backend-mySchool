import { registerAs } from '@nestjs/config';

export default registerAs('cors', () => ({
  origins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  allowLocalhost: process.env.CORS_ALLOW_LOCALHOST !== 'false',
}));
