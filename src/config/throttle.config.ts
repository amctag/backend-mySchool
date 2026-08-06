import { registerAs } from '@nestjs/config';

export default registerAs('throttle', () => ({
  ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  authTtl: parseInt(process.env.THROTTLE_AUTH_TTL ?? '60000', 10),
  authLimit: parseInt(process.env.THROTTLE_AUTH_LIMIT ?? '5', 10),
}));
