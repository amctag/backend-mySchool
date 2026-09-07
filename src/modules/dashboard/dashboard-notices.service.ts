import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FcmService } from '../../fcm/fcm.service';
import { CreateDashboardNoticeDto } from './dto/create-dashboard-notice.dto';
import { DashboardNoticesQueryDto } from './dto/dashboard-notices-query.dto';
import {
  DashboardNoticeItemDto,
  DashboardNoticesResponseDto,
} from './dto/dashboard-notices-response.dto';

const DASHBOARD_CREATOR_PERSON_ID = 1;

const noticeInclude = {
  person: {
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
    },
  },
  noticeType: {
    select: { id: true, title: true },
  },
  students: {
    where: { deletedAt: null },
    select: { studentId: true },
  },
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

type NoticeRecord = {
  id: number;
  description: string;
  date: Date;
  status: boolean;
  personId: number;
  createdAt: Date;
  noticeType: { id: number; title: string } | null;
  person: {
    id: number;
    firstName: string;
    middleName: string;
    lastName: string;
  };
  students: Array<{ studentId: number }>;
  sections: Array<{
    sectionId: number;
    section: {
      class: { className: string };
      sectionTitle: { title: string };
    };
  }>;
};

@Injectable()
export class DashboardNoticesService {
  private readonly logger = new Logger(DashboardNoticesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmService,
  ) {}

  async listNotices(
    user: AuthenticatedSchool,
    query: DashboardNoticesQueryDto,
  ): Promise<DashboardNoticesResponseDto> {
    await this.assertCreatorPersonExists();

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = this.buildWhere(user.schoolId, query);

    const [total, notices] = await this.prisma.$transaction([
      this.prisma.notice.count({ where }),
      this.prisma.notice.findMany({
        where,
        include: noticeInclude,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: notices.map((notice) => this.toItem(notice)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getNotice(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardNoticeItemDto> {
    await this.assertCreatorPersonExists();

    const notice = await this.prisma.notice.findFirst({
      where: {
        id,
        schoolId: user.schoolId,
        deletedAt: null,
      },
      include: noticeInclude,
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    return this.toItem(notice);
  }

  async createNotice(
    user: AuthenticatedSchool,
    dto: CreateDashboardNoticeDto,
  ): Promise<DashboardNoticeItemDto> {
    const personId = DASHBOARD_CREATOR_PERSON_ID;
    await this.assertCreatorPersonExists();

    let noticeTypeId: number | undefined;
    if (dto.noticeTypeId) {
      const noticeType = await this.prisma.noticeType.findFirst({
        where: { id: dto.noticeTypeId, deletedAt: null },
        select: { id: true },
      });

      if (!noticeType) {
        throw new NotFoundException('Notice type not found');
      }

      noticeTypeId = noticeType.id;
    }

    let sectionId: number | undefined;
    if (dto.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: {
          id: dto.sectionId,
          schoolId: user.schoolId,
        },
        select: { id: true },
      });

      if (!section) {
        throw new NotFoundException('Section not found');
      }

      sectionId = section.id;
    }

    const uniqueStudentIds = [...new Set(dto.studentIds ?? [])];
    if (uniqueStudentIds.length > 0) {
      const students = await this.prisma.student.findMany({
        where: {
          id: { in: uniqueStudentIds },
          registrations: {
            some: {
              status: true,
              schoolId: user.schoolId,
            },
          },
        },
        select: { id: true },
      });

      if (students.length !== uniqueStudentIds.length) {
        throw new BadRequestException(
          'One or more students are not registered at this school',
        );
      }
    }

    const notice = await this.prisma.notice.create({
      data: {
        schoolId: user.schoolId,
        description: dto.description.trim(),
        personId,
        date: this.parseDate(dto.date),
        noticeTypeId,
        ...(sectionId
          ? {
              sections: {
                create: { sectionId },
              },
            }
          : {}),
        ...(uniqueStudentIds.length > 0
          ? {
              students: {
                create: uniqueStudentIds.map((studentId) => ({ studentId })),
              },
            }
          : {}),
      },
      include: noticeInclude,
    });

    if (uniqueStudentIds.length > 0) {
      await this.notifyParentsOfSelectedStudents(
        uniqueStudentIds,
        notice.id,
        notice.description,
        notice.noticeType?.title ?? null,
      );
    }

    return this.toItem(notice);
  }

  private async notifyParentsOfSelectedStudents(
    studentIds: number[],
    noticeId: number,
    description: string,
    noticeTypeTitle: string | null,
  ): Promise<void> {
    if (!this.fcmService.isReady()) {
      this.logger.warn(
        'Skipped notice FCM: FCM is not configured',
      );
      return;
    }

    const students = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
        parentId: { not: null },
      },
      select: {
        id: true,
        parent: {
          select: { personId: true },
        },
      },
    });

    const personIds = [
      ...new Set(
        students
          .map((student) => student.parent?.personId)
          .filter((id): id is number => id !== undefined),
      ),
    ];

    if (personIds.length === 0) {
      return;
    }

    const tokens = await this.prisma.fcmToken.findMany({
      where: { personId: { in: personIds } },
    });

    const title = noticeTypeTitle?.trim() || 'Notice';
    const body =
      description.length > 180 ? `${description.slice(0, 177)}...` : description;

    for (const row of tokens) {
      const result = await this.fcmService.trySendNotification(
        row.token,
        title,
        body,
        {
          type: 'notice',
          noticeId: String(noticeId),
          personId: String(row.personId),
        },
      );

      if (result === 'invalid') {
        await this.prisma.fcmToken.deleteMany({
          where: { personId: row.personId },
        });
      }
    }
  }

  private parseDate(value?: string): Date {
    if (!value) {
      const today = new Date();
      return new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
        ),
      );
    }

    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private async assertCreatorPersonExists(): Promise<void> {
    const person = await this.prisma.person.findFirst({
      where: { id: DASHBOARD_CREATOR_PERSON_ID },
      select: { id: true },
    });

    if (!person) {
      throw new NotFoundException('Creator person not found');
    }
  }

  private buildWhere(
    schoolId: number,
    query: DashboardNoticesQueryDto,
  ): Prisma.NoticeWhereInput {
    const search = query.search?.trim();
    const where: Prisma.NoticeWhereInput = {
      schoolId,
      deletedAt: null,
    };

    if (search) {
      where.description = { contains: search, mode: 'insensitive' };
    }

    if (query.noticeTypeId) {
      where.noticeTypeId = query.noticeTypeId;
    }

    if (query.sectionId) {
      where.sections = {
        some: {
          deletedAt: null,
          sectionId: query.sectionId,
        },
      };
      return where;
    }

    if (query.classId) {
      where.sections = {
        some: {
          deletedAt: null,
          section: {
            classId: query.classId,
            ...(query.yearId ? { yearId: query.yearId } : {}),
          },
        },
      };
      return where;
    }

    if (query.yearId) {
      where.OR = [
        { sections: { none: { deletedAt: null } } },
        {
          sections: {
            some: {
              deletedAt: null,
              section: { yearId: query.yearId },
            },
          },
        },
      ];
    }

    return where;
  }

  private toItem(notice: NoticeRecord): DashboardNoticeItemDto {
    return {
      id: notice.id,
      description: notice.description,
      date: notice.date.toISOString().slice(0, 10),
      scope: this.formatScope(notice),
      noticeTypeId: notice.noticeType?.id ?? null,
      noticeTypeTitle: notice.noticeType?.title ?? null,
      sectionIds: notice.sections.map((item) => item.sectionId),
      studentIds: notice.students.map((item) => item.studentId),
      studentCount: notice.students.length,
      status: notice.status,
      createdAt: notice.createdAt.toISOString(),
      personId: notice.personId,
      createdByName: this.formatPersonName(notice.person),
    };
  }

  private formatPersonName(person: {
    firstName: string;
    middleName: string;
    lastName: string;
  }): string {
    return [person.firstName, person.middleName, person.lastName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');
  }

  private formatScope(notice: NoticeRecord): string {
    const sectionLabels = [
      ...new Set(
        notice.sections.map((item) => {
          const sectionTitle = item.section.sectionTitle.title.trim();
          return `${item.section.class.className} ${sectionTitle}`.trim();
        }),
      ),
    ];

    if (sectionLabels.length === 0 && notice.students.length === 0) {
      return 'All school';
    }

    const parts: string[] = [...sectionLabels];
    if (notice.students.length > 0) {
      parts.push(
        `${notice.students.length} student${notice.students.length === 1 ? '' : 's'}`,
      );
    }

    return parts.join(', ');
  }
}
