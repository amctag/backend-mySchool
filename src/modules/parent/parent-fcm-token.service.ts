import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedParent } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FcmService } from '../../fcm/fcm.service';
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

    const row = await this.prisma.fcmToken.upsert({
      where: { personId },
      create: { personId, token: trimmed },
      update: { token: trimmed },
    });

    return {
      personId: row.personId,
      token: row.token,
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
    const row = await this.prisma.fcmToken.findUnique({
      where: { personId: user.id },
    });

    if (!row) {
      throw new NotFoundException('No FCM token for this parent');
    }

    const title = dto.title?.trim() || DEFAULT_TITLE;
    const body = dto.body?.trim() || DEFAULT_BODY;

    try {
      const messageId = await this.fcmService.sendNotification(
        row.token,
        title,
        body,
        {
          type: 'test',
          personId: String(user.id),
        },
      );

      return { sent: true, personId: user.id, messageId };
    } catch (error) {
      if (this.fcmService.isInvalidTokenError(error)) {
        await this.deleteForPerson(user.id);
        throw new BadRequestException('FCM token is invalid or expired');
      }

      throw error;
    }
  }
}
