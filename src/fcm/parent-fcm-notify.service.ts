import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { FcmService } from './fcm.service';

@Injectable()
export class ParentFcmNotifyService {
  private readonly logger = new Logger(ParentFcmNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmService,
  ) {}

  async sendToPersonIds(
    personIds: number[],
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<void> {
    const uniquePersonIds = [...new Set(personIds)];
    if (uniquePersonIds.length === 0) {
      return;
    }

    if (!this.fcmService.isReady()) {
      this.logger.warn('Skipped parent FCM: FCM is not configured');
      return;
    }

    const tokens = await this.prisma.fcmToken.findMany({
      where: { personId: { in: uniquePersonIds } },
    });

    const pushTitle = title.trim() || 'Notification';
    const pushBody =
      body.length > 180 ? `${body.slice(0, 177)}...` : body;

    for (const row of tokens) {
      const result = await this.fcmService.trySendNotification(
        row.token,
        pushTitle,
        pushBody,
        {
          ...data,
          personId: String(row.personId),
        },
      );

      if (result === 'invalid') {
        await this.prisma.fcmToken.deleteMany({
          where: { personId: row.personId },
        });
      }
    }
  }
}
