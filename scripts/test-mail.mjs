import 'dotenv/config';
import nodemailer from 'nodemailer';

const host = (process.env.MAIL_HOST ?? '').trim();
const port = parseInt((process.env.MAIL_PORT ?? '465').trim(), 10);
const encryption = (process.env.MAIL_ENCRYPTION ?? 'ssl').trim().toLowerCase();
const user = (process.env.MAIL_USERNAME ?? process.env.MAIL_USER ?? '').trim();
const pass = (process.env.MAIL_PASSWORD ?? process.env.MAIL_PASS ?? '').trim();
const secure = encryption === 'ssl' && port === 465;
const requireTLS = port !== 465 && (encryption === 'ssl' || encryption === 'tls');

if (!host || !user || !pass) {
  console.error('Missing MAIL_HOST, MAIL_USERNAME, or MAIL_PASSWORD');
  process.exit(1);
}

console.log(`Testing SMTP ${host}:${port} secure=${secure} requireTLS=${requireTLS} user=${user}`);

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  requireTLS,
  auth: { user, pass },
  tls: { minVersion: 'TLSv1.2', rejectUnauthorized: false },
});

try {
  await transporter.verify();
  console.log('SMTP login OK');
  process.exit(0);
} catch (error) {
  console.error('SMTP login FAILED');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
