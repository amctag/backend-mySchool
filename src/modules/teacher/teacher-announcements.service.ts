import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TeacherAccessService } from './teacher-access.service';
import {
  TeacherAnnouncementItemDto,
  TeacherAnnouncementsQueryDto,
  TeacherAnnouncementsResponseDto,
} from './dto/teacher-announcements.dto';
import { formatClassLabel } from './teacher.util';

const announcementInclude = {
  sections: {
    where: { deletedAt: null },
    include: {
      section: {
        select: {
          class: { select: { className: true } },
          sectionTitle: { select: { title: true } },
        },
      },
    },
  },
} as const;

type AnnouncementRecord = Prisma.AnnouncementGetPayload<{
  include: typeof announcementInclude;
}>;

@Injectable()
export class TeacherAnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAccess: TeacherAccessService,
  ) {}

  async listAnnouncements(
    user: AuthenticatedTeacher,
    query: TeacherAnnouncementsQueryDto,
  ): Promise<TeacherAnnouncementsResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 20,
    });
    const where = await this.buildWhere(user);
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
      items: rows.map((row) => this.toItem(row)),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getAnnouncement(
    user: AuthenticatedTeacher,
    announcementId: number,
  ): Promise<TeacherAnnouncementItemDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const where = await this.buildWhere(user);
    const row = await this.prisma.announcement.findFirst({
      where: { ...where, id: announcementId },
      include: announcementInclude,
    });
    if (!row) {
      throw new NotFoundException('Announcement not found');
    }
    return this.toItem(row);
  }

  private async buildWhere(
    user: AuthenticatedTeacher,
  ): Promise<Prisma.AnnouncementWhereInput> {
    const teaches = await this.prisma.teach.findMany({
      where: {
        teacherId: user.teacherId,
        section: { schoolId: user.schoolId },
      },
      select: { sectionId: true },
    });
    const sectionIds = [...new Set(teaches.map((row) => row.sectionId))];
    const today = this.todayUtcDate();
    const currentTime = this.currentPublishTime();

    return {
      deletedAt: null,
      targets: {
        some: {
          audienceTarget: 'teacher',
          deletedAt: null,
        },
      },
      AND: [
        {
          OR: [
            { publishDate: { lt: today } },
            {
              publishDate: today,
              publishTime: { lte: currentTime },
            },
          ],
        },
      ],
      OR: [
        {
          sections: {
            none: { deletedAt: null },
          },
        },
        ...(sectionIds.length > 0
          ? [
              {
                sections: {
                  some: {
                    deletedAt: null,
                    sectionId: { in: sectionIds },
                    section: { schoolId: user.schoolId },
                  },
                },
              },
            ]
          : []),
      ],
    };
  }

  private toItem(row: AnnouncementRecord): TeacherAnnouncementItemDto {
    const section = row.sections[0]?.section;
    const isGlobal = row.sections.length === 0;
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      isGlobal,
      scopeLabel: isGlobal
        ? 'All school'
        : formatClassLabel(
            section?.class.className ?? '',
            section?.sectionTitle.title ?? '',
          ),
      publishedAt: this.combinePublishDateTime(row.publishDate, row.publishTime),
    };
  }

  private todayUtcDate(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private currentPublishTime(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(
        1970,
        0,
        1,
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds(),
      ),
    );
  }

  private combinePublishDateTime(publishDate: Date, publishTime: Date): string {
    const combined = new Date(publishDate);
    combined.setUTCHours(
      publishTime.getUTCHours(),
      publishTime.getUTCMinutes(),
      publishTime.getUTCSeconds(),
      0,
    );
    return combined.toISOString();
  }
}
