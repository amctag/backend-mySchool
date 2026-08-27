import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { JwtRole } from '../interfaces/jwt-payload.interface';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async isSessionActive(sessionId: string, role?: JwtRole): Promise<boolean> {
    if (role === 'school') {
      return this.isSchoolSessionActive(sessionId);
    }

    return this.isParentSessionActive(sessionId);
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.prisma.parentSession.deleteMany({
      where: { refreshExpiresAt: { lt: new Date() } },
    });

    await this.prisma.school.updateMany({
      where: { refreshExpiresAt: { lt: new Date() } },
      data: {
        sessionId: null,
        refreshTokenHash: null,
        refreshExpiresAt: null,
      },
    });
  }

  private async isParentSessionActive(sessionId: string): Promise<boolean> {
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

  private async isSchoolSessionActive(sessionId: string): Promise<boolean> {
    const school = await this.prisma.school.findFirst({
      where: { sessionId },
    });

    if (!school?.refreshExpiresAt) {
      return false;
    }

    if (school.refreshExpiresAt <= new Date()) {
      await this.prisma.school.update({
        where: { id: school.id },
        data: {
          sessionId: null,
          refreshTokenHash: null,
          refreshExpiresAt: null,
        },
      });
      return false;
    }

    return true;
  }
}
