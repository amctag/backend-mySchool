import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async isSessionActive(sessionId: string): Promise<boolean> {
    const session = await this.prisma.parentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return false;
    }

    if (session.refreshExpiresAt <= new Date()) {
      await this.prisma.parentSession.delete({ where: { id: sessionId } });
      return false;
    }

    return true;
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.prisma.parentSession.deleteMany({
      where: { refreshExpiresAt: { lt: new Date() } },
    });
  }
}
