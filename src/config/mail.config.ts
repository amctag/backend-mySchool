import { registerAs } from '@nestjs/config';

function parseMailPort(value: string | undefined): number {
  const parsed = parseInt(value ?? '587', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 587;
}

function resolveMailSecure(
  encryption: string | undefined,
  port: number,
): boolean {
  const normalized = (encryption ?? '').trim().toLowerCase();

  if (normalized === 'ssl') {
    return port === 465;
  }

  return false;
}

function resolveRequireTls(encryption: string | undefined): boolean {
  const normalized = (encryption ?? '').trim().toLowerCase();

  return normalized === 'ssl' || normalized === 'tls';
}

export default registerAs('mail', () => {
  const port = parseMailPort(process.env.MAIL_PORT);
  const encryption =
    process.env.MAIL_ENCRYPTION ?? process.env.MAIL_SECURE ?? 'tls';

  return {
    host: process.env.MAIL_HOST ?? '',
    port,
    secure: resolveMailSecure(encryption, port),
    requireTls: resolveRequireTls(encryption),
    user: process.env.MAIL_USERNAME ?? process.env.MAIL_USER ?? '',
    pass: process.env.MAIL_PASSWORD ?? process.env.MAIL_PASS ?? '',
    fromAddress:
      process.env.MAIL_FROM_ADDRESS ??
      process.env.MAIL_FROM ??
      'noreply@myschool.com',
    fromName: process.env.MAIL_FROM_NAME ?? 'My School',
    otpExpiresIn: process.env.OTP_EXPIRES_IN ?? '10m',
  };
});
