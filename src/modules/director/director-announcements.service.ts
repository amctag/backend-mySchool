import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DirectorAccessService } from './director-access.service';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import {
  DirectorAnnouncementsQueryDto,
  DirectorAnnouncementItemDto,
  DirectorAnnouncementsResponseDto,
} from './dto/director-announcements.dto';

const announcementInclude = {
  targets: {
    select: {
      audienceTarget: true,
    },
  },
} as const;

@Injectable()
export class DirectorAnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directorAccess: DirectorAccessService,
  ) {}

  async listAnnouncements(
    user: AuthenticatedDirector,
    query: DirectorAnnouncementsQueryDto,
  ): Promise<DirectorAnnouncementsResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 20,
    });

    const where: any = {
      ...(query.date ? { publishDate: query.date } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where,
        include: announcementInclude,
        orderBy: [
          { publishDate: 'desc' },
          { publishTime: 'desc' },
          { id: 'desc' },
        ],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title ?? 'Untitled Announcement',
        publishDate: row.publishDate?.toISOString().split('T')[0],
        publishTime: row.publishTime?.toISOString().split('T')[1]?.split('.')[0] || '',
        targetAudience: row.targets?.[0]?.audienceTarget ? row.targets[0].audienceTarget : 'all',
        targetGrades: row.targets?.length
          ? row.targets.map((t) => t.audienceTarget)
          : [],
        subject: '',
        content: row.content,
        createdAt: row.createdAt?.toISOString().split('T')[0] || '',
        createdBy: row.personId?.toString() || '',
      })),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getAnnouncement(
    user: AuthenticatedDirector,
    announcementId: number,
  ): Promise<DirectorAnnouncementItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const announcement = await this.prisma.announcement.findFirst({
      where: {
        id: announcementId,
      },
      include: announcementInclude,
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    return {
      id: announcement.id,
      title: announcement.title ?? 'Untitled Announcement',
      publishDate: announcement.publishDate?.toISOString().split('T')[0],
      publishTime: announcement.publishTime?.toISOString().split('T')[1]?.split('.')[0] || '',
      targetAudience: announcement.targets?.[0]?.audienceTarget ? announcement.targets[0].audienceTarget : 'all',
      targetGrades: announcement.targets?.length
        ? announcement.targets.map((t) => t.audienceTarget)
        : [],
      subject: '',
      content: announcement.content,
      createdAt: announcement.createdAt?.toISOString().split('T')[0] || '',
      createdBy: announcement.personId?.toString() || '',
    };
  }

  async createAnnouncement(
    user: AuthenticatedDirector,
    dto: any,
  ): Promise<DirectorAnnouncementItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        publishDate: dto.publishDate,
        publishTime: dto.publishTime,
        content: dto.content,
        personId: user.personId,
      },
    });

    return {
      id: announcement.id,
      title: announcement.title ?? 'Untitled Announcement',
      publishDate: announcement.publishDate?.toISOString().split('T')[0],
      publishTime: announcement.publishTime?.toISOString().split('T')[1]?.split('.')[0] || '',
      targetAudience: 'all',
      targetGrades: [],
      subject: '',
      content: announcement.content,
      createdAt: announcement.createdAt?.toISOString().split('T')[0] || '',
      createdBy: announcement.personId?.toString() || '',
    };
  }

  async updateAnnouncement(
    user: AuthenticatedDirector,
    announcementId: number,
    dto: any,
  ): Promise<DirectorAnnouncementItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const announcement = await this.prisma.announcement.findFirst({
      where: {
        id: announcementId,
      },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    const updated = await this.prisma.announcement.update({
      where: { id: announcementId },
      data: {
        title: dto.title,
        publishDate: dto.publishDate,
        publishTime: dto.publishTime,
        content: dto.content,
      },
    });

    return {
      id: updated.id,
      title: updated.title ?? 'Untitled Announcement',
      publishDate: updated.publishDate?.toISOString().split('T')[0],
      publishTime: updated.publishTime?.toISOString().split('T')[1]?.split('.')[0] || '',
      targetAudience: 'all',
      targetGrades: [],
      subject: '',
      content: updated.content,
      createdAt: updated.createdAt?.toISOString().split('T')[0] || '',
      createdBy: updated.personId?.toString() || '',
    };
  }

  async deleteAnnouncement(
    user: AuthenticatedDirector,
    announcementId: number,
  ): Promise<boolean> {
    this.directorAccess.ensureDirectorRole(user.role);

    const announcement = await this.prisma.announcement.findFirst({
      where: {
        id: announcementId,
      },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    await this.prisma.announcement.delete({
      where: { id: announcementId },
    });

    return true;
  }
}