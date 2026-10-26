import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DirectorAccessService } from './director-access.service';
import {
  DirectorNotificationsQueryDto,
  DirectorNotificationItemDto,
  DirectorNotificationsResponseDto,
} from './dto/director-notifications.dto';

@Injectable()
export class DirectorNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directorAccess: DirectorAccessService,
  ) {}

  async getNotifications(
    user: AuthenticatedDirector,
  ): Promise<DirectorNotificationsResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const rows = await this.prisma.personNotification.findMany({
      where: { personId: user.personId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      notifications: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        title: row.title,
        body: row.body,
        type: row.type ? row.type : 'default',
        route: row.route ? row.route : '',
      })),
    };
  }
}