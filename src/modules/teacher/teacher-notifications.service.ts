import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TeacherAccessService } from './teacher-access.service';
import { TeacherNotificationsResponseDto } from './dto/teacher-notifications.dto';

@Injectable()
export class TeacherNotificationsService {
  private readonly logger = new Logger(TeacherNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAccess: TeacherAccessService,
  ) {}

  async getNotifications(
    user: AuthenticatedTeacher,
  ): Promise<TeacherNotificationsResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);

    const rows = await this.prisma.personNotification.findMany({
      where: { personId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    this.logger.debug(
      `Loaded ${rows.length} notifications for person ${user.id}`,
    );

    return {
      notifications: rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        type: row.type,
        route: row.route,
        data: this.parseNotificationData(row.data),
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private parseNotificationData(raw: string): Record<string, string> {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      const data: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value == null) continue;
        data[key] = String(value);
      }
      return data;
    } catch {
      return {};
    }
  }
}
