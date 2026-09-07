import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private ready = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.configService.get<string>('fcm.projectId') ?? '';
    const credentialsBase64 =
      this.configService.get<string>('fcm.credentialsBase64') ?? '';

    if (!projectId || !credentialsBase64) {
      this.logger.warn(
        'FCM not configured. Set FCM_PROJECT_ID and FCM_CREDENTIALS_BASE64.',
      );
      return;
    }

    try {
      const parsed = JSON.parse(
        Buffer.from(credentialsBase64, 'base64').toString('utf8'),
      ) as ServiceAccountJson;

      if (!getApps().length) {
        initializeApp({
          credential: cert({
            projectId: parsed.project_id ?? projectId,
            clientEmail: parsed.client_email,
            privateKey: parsed.private_key,
          }),
          projectId,
        });
      }

      this.ready = true;
      this.logger.log(`FCM configured for project ${projectId}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown FCM init error';
      this.logger.error(`Failed to initialize FCM: ${message}`);
    }
  }

  async sendNotification(
    token: string,
    title: string,
    body: string,
    data: Record<string, string> = { type: 'test' },
  ): Promise<string> {
    if (!this.ready) {
      throw new ServiceUnavailableException(
        'FCM is not configured. Set FCM_PROJECT_ID and FCM_CREDENTIALS_BASE64.',
      );
    }

    try {
      return await getMessaging().send({
        token,
        notification: { title, body },
        data,
        android: { priority: 'high' },
        apns: {
          payload: {
            aps: { sound: 'default' },
          },
        },
      });
    } catch (error) {
      if (this.isInvalidTokenError(error)) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Failed to send FCM notification';
      this.logger.error(`FCM send failed: ${message}`);
      throw new BadGatewayException(message);
    }
  }

  isInvalidTokenError(error: unknown): boolean {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : '';

    return (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    );
  }
}
