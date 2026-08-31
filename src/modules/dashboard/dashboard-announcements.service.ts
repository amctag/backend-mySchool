import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardAnnouncementDto } from './dto/create-dashboard-announcement.dto';
import { DashboardAnnouncementItemDto } from './dto/dashboard-announcements-response.dto';
import { DashboardAnnouncementsQueryDto } from './dto/dashboard-announcements-query.dto';

const DEFAULT_PERSON_ID = 1;

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
    user: AuthenticatedSchool,
    query: DashboardAnnouncementsQueryDto,
  ): Promise<DashboardAnnouncementItemDto[]> {
    const personId = query.personId ?? DEFAULT_PERSON_ID;

    const announcements = await this.prisma.announcement.findMany({
      where: {
        deletedAt: null,
        personId,
        person: { schoolId: user.schoolId },
      },
      include: announcementInclude,
      orderBy: [
        { publishDate: 'desc' },
        { publishTime: 'desc' },
        { id: 'desc' },
      ],
    });

    return announcements.map((announcement) => this.toItem(announcement));
  }

  async getAnnouncement(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardAnnouncementItemDto> {
    const announcement = await this.prisma.announcement.findFirst({
      where: {
        id,
        deletedAt: null,
        person: { schoolId: user.schoolId },
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
    const personId = dto.personId ?? DEFAULT_PERSON_ID;
    await this.assertPersonInSchool(personId, user.schoolId);

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

    const now = new Date();
    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title?.trim() || null,
        content: dto.content.trim(),
        personId,
        publishDate: now,
        publishTime: now,
        targets: {
          create: { audienceTarget: dto.audienceTarget },
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

  private async assertPersonInSchool(
    personId: number,
    schoolId: number,
  ): Promise<void> {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, schoolId },
      select: { id: true },
    });

    if (!person) {
      throw new NotFoundException('Person not found for this school');
    }
  }

  private toItem(announcement: AnnouncementRecord): DashboardAnnouncementItemDto {
    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      audience: this.formatAudience(announcement),
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

  private formatAudience(announcement: AnnouncementRecord): string {
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
