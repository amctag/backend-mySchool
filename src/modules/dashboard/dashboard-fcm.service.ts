import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FcmService } from '../../fcm/fcm.service';
import { FcmTokenStore } from '../../fcm/fcm-token.store';
import {
  SendDashboardFcmTestDto,
  SendDashboardFcmTestResponseDto,
} from './dto/send-dashboard-fcm-test.dto';

const DEFAULT_TITLE = 'Test notification';
const DEFAULT_BODY = 'This is a test from My School.';

@Injectable()
export class DashboardFcmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmService,
    private readonly fcmTokens: FcmTokenStore,
  ) {}

  async sendTest(
    user: AuthenticatedSchool,
    dto: SendDashboardFcmTestDto,
  ): Promise<SendDashboardFcmTestResponseDto> {
    const parent = await this.prisma.parent.findFirst({
      where: {
        personId: dto.personId,
        students: {
          some: {
            registrations: {
              some: { schoolId: user.schoolId },
            },
          },
        },
      },
      select: { personId: true },
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    const rows = await this.prisma.fcmToken.findMany({
      where: { personId: dto.personId },
    });

    if (rows.length === 0) {
      throw new NotFoundException('No FCM token for this parent');
    }

    const title = dto.title?.trim() || DEFAULT_TITLE;
    const body = dto.body?.trim() || DEFAULT_BODY;

    let messageId = '';
      let sent = false;
      for (const row of rows) {
        try {
          messageId = await this.fcmService.sendNotification(
            row.token,
            title,
            body,
            {
              type: 'test',
              personId: String(dto.personId),
            },
          );
          sent = true;
        } catch (error) {
          if (this.fcmService.isInvalidTokenError(error)) {
            await this.fcmTokens.deleteToken(row.token);
            continue;
          }
          throw error;
        }
      }

      if (!sent) {
        throw new BadRequestException('FCM token is invalid or expired');
      }

    return { sent: true, personId: dto.personId, messageId };
  }
}
