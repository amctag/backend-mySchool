import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';

@Injectable()
export class FcmTokenStore {
  constructor(private readonly prisma: PrismaService) {}

  /** Saves this device token without removing the person's other devices. */
  async save(personId: number, token: string): Promise<void> {
    const trimmed = token.trim();
    if (!trimmed) {
      return;
    }

    await this.prisma.fcmToken.upsert({
      where: { token: trimmed },
      create: { personId, token: trimmed },
      update: { personId },
    });
  }

  async deleteToken(token: string): Promise<void> {
    await this.prisma.fcmToken.deleteMany({ where: { token } });
  }
}
