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

    const pushTitle = (title.trim() || 'Notification').slice(0, 255);
    const pushBody =
      body.length > 180 ? `${body.slice(0, 177)}...` : body;
    const type = data.type?.trim() || null;
    const route = data.route?.trim() || null;
    const dataJson = JSON.stringify(data);

    await this.prisma.personNotification.createMany({
      data: uniquePersonIds.map((personId) => ({
        personId,
        title: pushTitle,
        body: pushBody,
        type,
        route,
        data: dataJson,
      })),
    });
    this.logger.log(
      `Saved ${uniquePersonIds.length} person notification(s): ${pushTitle}`,
    );

    if (!this.fcmService.isReady()) {
      this.logger.warn('Saved person notifications; FCM is not configured');
      return;
    }

    const tokens = await this.prisma.fcmToken.findMany({
      where: { personId: { in: uniquePersonIds } },
    });

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
