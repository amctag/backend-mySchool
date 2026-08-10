import { registerAs } from '@nestjs/config';

function trim(value: string | undefined): string {
  let trimmed = (value ?? '').trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function parseMailPort(value: string | undefined): number {
  const parsed = parseInt(trim(value) || '465', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 465;
}

function resolveMailSecure(
  encryption: string | undefined,
  port: number,
): boolean {
  const normalized = trim(encryption).toLowerCase();

  if (normalized === 'ssl') {
    return port === 465;
  }

  return false;
}

function resolveRequireTls(
  encryption: string | undefined,
  port: number,
): boolean {
  const normalized = trim(encryption).toLowerCase();

  if (port === 465) {
    return false;
  }

  return normalized === 'ssl' || normalized === 'tls';
}

export default registerAs('mail', () => {
  const port = parseMailPort(process.env.MAIL_PORT);
  const encryption =
    trim(process.env.MAIL_ENCRYPTION) || trim(process.env.MAIL_SECURE) || 'ssl';

  return {
    host: trim(process.env.MAIL_HOST),
    port,
    secure: resolveMailSecure(encryption, port),
    requireTls: resolveRequireTls(encryption, port),
    user: trim(process.env.MAIL_USERNAME) || trim(process.env.MAIL_USER),
    pass: trim(process.env.MAIL_PASSWORD) || trim(process.env.MAIL_PASS),
    fromAddress:
      trim(process.env.MAIL_FROM_ADDRESS) ||
      trim(process.env.MAIL_FROM) ||
      'noreply@myschool.com',
    fromName: trim(process.env.MAIL_FROM_NAME) || 'My School',
    otpExpiresIn: trim(process.env.OTP_EXPIRES_IN) || '10m',
  };
});
