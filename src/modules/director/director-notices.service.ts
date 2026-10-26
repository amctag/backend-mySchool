import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DirectorAccessService } from './director-access.service';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import {
  DirectorNoticesQueryDto,
  DirectorNoticeItemDto,
  DirectorNoticesResponseDto,
} from './dto/director-notices.dto';

@Injectable()
export class DirectorNoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directorAccess: DirectorAccessService,
  ) {}

  async listNotices(
    user: AuthenticatedDirector,
    query: DirectorNoticesQueryDto,
  ): Promise<DirectorNoticesResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 20,
    });

    const where: any = {
      ...(query.date ? { date: query.date } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.notice.count({ where }),
      this.prisma.notice.findMany({
        where,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        date: row.date?.toISOString().split('T')[0],
        title: row.title,
        content: row.description,
        createdAt: row.createdAt?.toISOString().split('T')[0] || '',
        createdBy: '',
      })),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getNotice(
    user: AuthenticatedDirector,
    noticeId: number,
  ): Promise<DirectorNoticeItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const notice = await this.prisma.notice.findFirst({
      where: {
        id: noticeId,
      },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    return {
      id: notice.id,
      date: notice.date?.toISOString().split('T')[0],
      title: notice.title,
      content: notice.description,
      createdAt: notice.createdAt?.toISOString().split('T')[0] || '',
      createdBy: '',
    };
  }

  async createNotice(
    user: AuthenticatedDirector,
    dto: any,
  ): Promise<DirectorNoticeItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const notice = await this.prisma.notice.create({
      data: {
        title: dto.title,
        description: dto.description,
        date: dto.date,
        personId: user.personId,
        schoolId: user.schoolId,
      },
    });

    return {
      id: notice.id,
      date: notice.date?.toISOString().split('T')[0],
      title: notice.title,
      content: notice.description,
      createdAt: notice.createdAt?.toISOString().split('T')[0] || '',
      createdBy: '',
    };
  }

  async updateNotice(
    user: AuthenticatedDirector,
    noticeId: number,
    dto: any,
  ): Promise<DirectorNoticeItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const notice = await this.prisma.notice.findFirst({
      where: {
        id: noticeId,
      },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const updated = await this.prisma.notice.update({
      where: { id: noticeId },
      data: {
        title: dto.title,
        description: dto.description,
        date: dto.date,
      },
    });

    return {
      id: updated.id,
      date: updated.date?.toISOString().split('T')[0],
      title: updated.title,
      content: updated.description,
      createdAt: updated.createdAt?.toISOString().split('T')[0] || '',
      createdBy: '',
    };
  }

  async deleteNotice(
    user: AuthenticatedDirector,
    noticeId: number,
  ): Promise<boolean> {
    this.directorAccess.ensureDirectorRole(user.role);

    const notice = await this.prisma.notice.findFirst({
      where: {
        id: noticeId,
      },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    await this.prisma.notice.delete({
      where: { id: noticeId },
    });

    return true;
  }
}