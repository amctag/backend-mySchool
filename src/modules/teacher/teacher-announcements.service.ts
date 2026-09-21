import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ParentFcmNotifyService } from '../../fcm/parent-fcm-notify.service';
import { TeacherAccessService } from './teacher-access.service';
import {
  CreateTeacherAnnouncementDto,
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
    private readonly parentFcmNotify: ParentFcmNotifyService,
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
    const where = await this.buildWhere(user, query);
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

  async createAnnouncement(
    user: AuthenticatedTeacher,
    dto: CreateTeacherAnnouncementDto,
  ): Promise<TeacherAnnouncementItemDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const isSupervisor = await this.teacherAccess.isSupervisorOfSection(
      user,
      dto.sectionId,
    );
    if (!isSupervisor) {
      throw new ForbiddenException(
        'Only supervisors can send announcements for this class',
      );
    }
    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Content is required');
    }
    const section = await this.prisma.section.findFirst({
      where: { id: dto.sectionId, schoolId: user.schoolId },
      select: { id: true, classId: true },
    });
    if (!section) {
      throw new NotFoundException('Class not found');
    }
    const now = new Date();
    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title?.trim() || null,
        content,
        personId: user.id,
        publishDate: now,
        publishTime: now,
        targets: {
          create: { audienceTarget: dto.audience },
        },
        sections: {
          create: {
            sectionId: section.id,
            classId: section.classId,
          },
        },
      },
      include: announcementInclude,
    });

    if (dto.audience === 'parent') {
      await this.notifyParentAudience(
        user.schoolId,
        section.id,
        announcement.id,
        announcement.title,
        announcement.content,
      );
    } else {
      await this.notifyTeacherAudience(
        user.schoolId,
        section.id,
        announcement.id,
        announcement.title,
        announcement.content,
      );
    }

    return this.toItem(announcement);
  }

  private async buildWhere(
    user: AuthenticatedTeacher,
    query?: TeacherAnnouncementsQueryDto,
  ): Promise<Prisma.AnnouncementWhereInput> {
    const teaches = await this.prisma.teach.findMany({
      where: {
        teacherId: user.teacherId,
        section: { schoolId: user.schoolId },
      },
      select: {
        sectionId: true,
        section: { select: { classId: true } },
      },
    });
    const supervised = await this.prisma.teacherSupervisor.findMany({
      where: {
        teacherId: user.teacherId,
        section: { schoolId: user.schoolId },
      },
      select: {
        sectionId: true,
        section: { select: { classId: true } },
      },
    });
    const scoped = [...teaches, ...supervised];
    const taughtSectionIds = [...new Set(scoped.map((row) => row.sectionId))];
    const today = this.todayUtcDate();
    const currentTime = this.currentPublishTime();
    const published: Prisma.AnnouncementWhereInput = {
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
    };

    const filteredSectionIds = this.resolveFilterSectionIds(
      scoped,
      query?.classId,
      query?.sectionId,
    );
    if (filteredSectionIds !== null) {
      if (filteredSectionIds.length === 0) {
        return { id: -1 };
      }
      return {
        ...published,
        sections: {
          some: {
            deletedAt: null,
            sectionId: { in: filteredSectionIds },
            section: { schoolId: user.schoolId },
          },
        },
      };
    }

    return {
      ...published,
      OR: [
        {
          sections: {
            none: { deletedAt: null },
          },
        },
        ...(taughtSectionIds.length > 0
          ? [
              {
                sections: {
                  some: {
                    deletedAt: null,
                    sectionId: { in: taughtSectionIds },
                    section: { schoolId: user.schoolId },
                  },
                },
              },
            ]
          : []),
      ],
    };
  }

  private resolveFilterSectionIds(
    teaches: Array<{ sectionId: number; section: { classId: number } }>,
    classId?: number,
    sectionId?: number,
  ): number[] | null {
    if (sectionId == null && classId == null) {
      return null;
    }
    let allowed = teaches.map((row) => row.sectionId);
    if (classId != null) {
      allowed = teaches
        .filter((row) => row.section.classId === classId)
        .map((row) => row.sectionId);
    }
    if (sectionId != null) {
      allowed = allowed.filter((id) => id === sectionId);
    }
    return [...new Set(allowed)];
  }

  private async notifyParentAudience(
    schoolId: number,
    sectionId: number,
    announcementId: number,
    title: string | null,
    content: string,
  ): Promise<void> {
    const parents = await this.prisma.parent.findMany({
      where: {
        students: {
          some: {
            registrations: {
              some: {
                status: true,
                schoolId,
                sectionId,
              },
            },
          },
        },
      },
      select: { personId: true },
    });

    await this.parentFcmNotify.sendToPersonIds(
      parents.map((parent) => parent.personId),
      title?.trim() || 'Announcement',
      content,
      {
        type: 'announcement',
        announcementId: String(announcementId),
        route: 'announcements',
      },
    );
  }

  private async notifyTeacherAudience(
    schoolId: number,
    sectionId: number,
    announcementId: number,
    title: string | null,
    content: string,
  ): Promise<void> {
    const teachers = await this.prisma.teacher.findMany({
      where: {
        person: { status: true },
        schools: {
          some: {
            schoolId,
            isActive: true,
          },
        },
        teaches: { some: { sectionId } },
      },
      select: { personId: true },
    });

    const pushTitle = title?.trim() || 'Announcement';
    const pushBody =
      content.length > 180 ? `${content.slice(0, 177)}...` : content;
    await this.parentFcmNotify.sendToPersonIds(
      teachers.map((teacher) => teacher.personId),
      pushTitle,
      content,
      {
        type: 'announcement',
        announcementId: String(announcementId),
        title: pushTitle,
        body: pushBody,
        route: 'announcements',
      },
    );
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
