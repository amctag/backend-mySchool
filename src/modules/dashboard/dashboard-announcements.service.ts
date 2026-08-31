import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardAnnouncementDto } from './dto/create-dashboard-announcement.dto';
import {
  DashboardAnnouncementItemDto,
  DashboardAnnouncementsResponseDto,
} from './dto/dashboard-announcements-response.dto';
import { DashboardAnnouncementsQueryDto } from './dto/dashboard-announcements-query.dto';

const DASHBOARD_CREATOR_PERSON_ID = 1;

const announcementInclude = {
  person: {
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
    },
  },
  targets: {
    where: { deletedAt: null },
    select: { audienceTarget: true },
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

type AnnouncementRecord = {
  id: number;
  title: string | null;
  content: string;
  personId: number;
  publishDate: Date;
  publishTime: Date;
  createdAt: Date;
  person: {
    id: number;
    firstName: string;
    middleName: string;
    lastName: string;
  };
  targets: Array<{ audienceTarget: string }>;
  sections: Array<{
    section: {
      class: { className: string };
      sectionTitle: { title: string };
    };
  }>;
};

@Injectable()
export class DashboardAnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAnnouncements(
    _user: AuthenticatedSchool,
    query: DashboardAnnouncementsQueryDto,
  ): Promise<DashboardAnnouncementsResponseDto> {
    await this.assertCreatorPersonExists();

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = this.buildWhere(query);

    const [total, announcements] = await this.prisma.$transaction([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where,
        include: announcementInclude,
        orderBy: [
          { publishDate: 'desc' },
          { publishTime: 'desc' },
          { id: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: announcements.map((announcement) => this.toItem(announcement)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getAnnouncement(
    _user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardAnnouncementItemDto> {
    await this.assertCreatorPersonExists();

    const announcement = await this.prisma.announcement.findFirst({
      where: {
        id,
        deletedAt: null,
        personId: DASHBOARD_CREATOR_PERSON_ID,
      },
      include: announcementInclude,
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    return this.toItem(announcement);
  }

  async createAnnouncement(
    user: AuthenticatedSchool,
    dto: CreateDashboardAnnouncementDto,
  ): Promise<DashboardAnnouncementItemDto> {
    const personId = DASHBOARD_CREATOR_PERSON_ID;
    await this.assertCreatorPersonExists();

    let sectionLink: { sectionId: number; classId: number } | undefined;
    if (dto.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: {
          id: dto.sectionId,
          schoolId: user.schoolId,
        },
        select: { id: true, classId: true },
      });

      if (!section) {
        throw new NotFoundException('Section not found');
      }

      sectionLink = {
        sectionId: section.id,
        classId: section.classId,
      };
    }

    const uniqueTargets = [...new Set(dto.audienceTargets)];

    const now = new Date();
    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title?.trim() || null,
        content: dto.content.trim(),
        personId,
        publishDate: now,
        publishTime: now,
        targets: {
          create: uniqueTargets.map((audienceTarget) => ({ audienceTarget })),
        },
        ...(sectionLink
          ? {
              sections: {
                create: sectionLink,
              },
            }
          : {}),
      },
      include: announcementInclude,
    });

    return this.toItem(announcement);
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
    query: DashboardAnnouncementsQueryDto,
  ): Prisma.AnnouncementWhereInput {
    const search = query.search?.trim();
    const where: Prisma.AnnouncementWhereInput = {
      deletedAt: null,
      personId: DASHBOARD_CREATOR_PERSON_ID,
    };

    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
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
          classId: query.classId,
          ...(query.yearId
            ? { section: { yearId: query.yearId } }
            : {}),
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

  private toItem(announcement: AnnouncementRecord): DashboardAnnouncementItemDto {
    const audienceTargets = announcement.targets.map(
      (target) => target.audienceTarget,
    );

    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      scope: this.formatScope(announcement),
      audienceTargets,
      audienceLabel: this.formatAudienceLabel(audienceTargets),
      publishedAt: this.combinePublishDateTime(
        announcement.publishDate,
        announcement.publishTime,
      ).toISOString(),
      createdAt: announcement.createdAt.toISOString(),
      personId: announcement.personId,
      createdByName: this.formatPersonName(announcement.person),
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

  private formatAudienceLabel(targets: string[]): string {
    const labels: Record<string, string> = {
      parent: 'Parents',
      student: 'Students',
      teacher: 'Teachers',
    };

    return targets
      .map((target) => labels[target] ?? target)
      .join(', ');
  }

  private formatScope(announcement: AnnouncementRecord): string {
    if (announcement.sections.length === 0) {
      return 'All school';
    }

    const labels = [
      ...new Set(
        announcement.sections.map((item) => {
          const sectionTitle = item.section.sectionTitle.title.trim();
          return `${item.section.class.className} ${sectionTitle}`.trim();
        }),
      ),
    ];

    return labels.join(', ');
  }

  private combinePublishDateTime(publishDate: Date, publishTime: Date): Date {
    const combined = new Date(publishDate);
    const time = new Date(publishTime);

    combined.setUTCHours(
      time.getUTCHours(),
      time.getUTCMinutes(),
      time.getUTCSeconds(),
      0,
    );

    return combined;
  }
}
