import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedParent } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FcmService } from '../../fcm/fcm.service';
import { FcmTokenStore } from '../../fcm/fcm-token.store';
import { ParentFcmTokenResponseDto } from './dto/parent-fcm-token.dto';
import {
  SendParentFcmTestDto,
  SendParentFcmTestResponseDto,
} from './dto/parent-fcm-test.dto';

const DEFAULT_TITLE = 'Test notification';
const DEFAULT_BODY = 'This is a test from My School.';

@Injectable()
export class ParentFcmTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmService,
    private readonly fcmTokens: FcmTokenStore,
  ) {}

  async upsert(
    user: AuthenticatedParent,
    token: string,
  ): Promise<ParentFcmTokenResponseDto> {
    return this.upsertForPerson(user.id, token);
  }

  async upsertForPerson(
    personId: number,
    token: string,
  ): Promise<ParentFcmTokenResponseDto> {
    const trimmed = token.trim();
    await this.fcmTokens.save(personId, trimmed);

    return {
      personId,
      token: trimmed,
    };
  }

  async deleteForPerson(personId: number): Promise<void> {
    await this.prisma.fcmToken.deleteMany({
      where: { personId },
    });
  }

  async sendTest(
    user: AuthenticatedParent,
    dto: SendParentFcmTestDto,
  ): Promise<SendParentFcmTestResponseDto> {
    const rows = await this.prisma.fcmToken.findMany({
      where: { personId: user.id },
    });

    if (rows.length === 0) {
      throw new NotFoundException('No FCM token for this parent');
    }

    const title = dto.title?.trim() || DEFAULT_TITLE;
    const body = dto.body?.trim() || DEFAULT_BODY;

    await this.prisma.personNotification.create({
        data: {
          personId: user.id,
          title: title.slice(0, 255),
          body,
          type: 'test',
          route: null,
          data: JSON.stringify({
            type: 'test',
            personId: String(user.id),
          }),
        },
      });

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
              personId: String(user.id),
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

      return { sent: true, personId: user.id, messageId };
  }
}
