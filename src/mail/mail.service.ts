import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { MailSendFailedException } from './mail-send-failed.exception';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendOtpEmail(to: string, otp: string, name: string): Promise<void> {
    const subject = 'Your password change verification code';
    const text =
      `Hello ${name},\n\n` +
      `Your verification code is: ${otp}\n\n` +
      `This code expires in 10 minutes. If you did not request a password change, ignore this email.\n`;

    const html =
      `<p>Hello ${name},</p>` +
      `<p>Your verification code is:</p>` +
      `<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p>` +
      `<p>This code expires in 10 minutes. If you did not request a password change, ignore this email.</p>`;

    await this.sendMail(to, subject, text, html);
  }

  private async sendMail(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    const from = this.getFromAddress();

    if (!this.isConfigured()) {
      this.logger.warn(`Mail not configured. OTP email to ${to} was not sent.`);
      this.logger.warn(`Subject: ${subject}`);
      this.logger.warn(text);
      return;
    }

    const host = this.configService.get<string>('mail.host');
    const port = this.configService.get<number>('mail.port') ?? 587;
    const user = this.configService.get<string>('mail.user');

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({ from, to, subject, text, html });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown mail error';

      this.logger.error(
        `Failed to send email via ${host}:${port} as ${user} — ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new MailSendFailedException();
    }
  }

  private getFromAddress(): string {
    const fromAddress =
      this.configService.get<string>('mail.fromAddress') ??
      'noreply@myschool.com';
    const fromName =
      this.configService.get<string>('mail.fromName') ?? 'My School';

    return `"${fromName}" <${fromAddress}>`;
  }

  private isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('mail.host') &&
        this.configService.get<string>('mail.user') &&
        this.configService.get<string>('mail.pass'),
    );
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('mail.host'),
        port: this.configService.get<number>('mail.port') ?? 587,
        secure: this.configService.get<boolean>('mail.secure') ?? false,
        requireTLS: this.configService.get<boolean>('mail.requireTls') ?? true,
        auth: {
          user: this.configService.get<string>('mail.user'),
          pass: this.configService.get<string>('mail.pass'),
        },
        tls: {
          minVersion: 'TLSv1.2',
        },
      });
    }

    return this.transporter;
  }
}
