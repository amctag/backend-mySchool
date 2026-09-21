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

    if (role === 'teacher') {
      return this.isTeacherSessionActive(sessionId);
    }

    return this.isParentSessionActive(sessionId);
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.prisma.parentSession.deleteMany({
      where: { refreshExpiresAt: { lt: new Date() } },
    });

    await this.prisma.teacherSession.deleteMany({
      where: { refreshExpiresAt: { lt: new Date() } },
    });

    await this.prisma.schoolSession.deleteMany({
      where: { refreshExpiresAt: { lt: new Date() } },
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

  private async isTeacherSessionActive(sessionId: string): Promise<boolean> {
    const session = await this.prisma.teacherSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return false;
    }

    if (session.refreshExpiresAt <= new Date()) {
      await this.prisma.teacherSession.delete({ where: { id: sessionId } });
      return false;
    }

    return true;
  }

  private async isSchoolSessionActive(sessionId: string): Promise<boolean> {
    const session = await this.prisma.schoolSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return false;
    }

    if (session.refreshExpiresAt <= new Date()) {
      await this.prisma.schoolSession.delete({ where: { id: sessionId } });
      return false;
    }

    return true;
  }
}
