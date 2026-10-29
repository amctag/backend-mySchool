import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DirectorAccessService } from './director-access.service';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import {
  TeacherActivitiesQueryDto,
  TeacherActivityItemDto,
  TeacherActivitiesResponseDto,
  UpsertTeacherActivityDto,
} from './dto/director-activities.dto';

const activityInclude = {
  year: { select: { id: true, title: true, schoolId: true } },
  course: { select: { id: true, title: true } },
  sections: {
    include: {
      section: {
        select: {
          class: {
            select: {
              className: true,
            },
          },
          sectionTitle: { select: { title: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class DirectorActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directorAccess: DirectorAccessService,
  ) {}

  async listActivities(
    user: AuthenticatedDirector,
    query: TeacherActivitiesQueryDto,
  ): Promise<TeacherActivitiesResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 20,
    });

    const where: any = {
      ...(query.date ? { date: query.date } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        include: activityInclude,
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
        description: row.content,
        startDate: row.date?.toISOString().split('T')[0] || '',
        endDate: '',
        courseTitle: row.course?.title || '',
        gradeLevels: row.sections?.length
          ? row.sections.map((s) => s.section.class.className)
          : [],
        sectionTitles: row.sections?.length
          ? row.sections.map((s) => s.section.sectionTitle.title)
          : [],
        createdBy: row.personId?.toString() || '',
        createdAt: row.createdAt?.toISOString().split('T')[0] || '',
      })),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getActivity(
    user: AuthenticatedDirector,
    activityId: number,
  ): Promise<TeacherActivityItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const activity = await this.prisma.activity.findFirst({
      where: {
        id: activityId,
      },
      include: activityInclude,
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    return {
      id: activity.id,
      date: activity.date?.toISOString().split('T')[0],
      title: activity.title,
      description: activity.content,
      startDate: activity.date?.toISOString().split('T')[0] || '',
      endDate: '',
      courseTitle: '',
      gradeLevels: [],
      sectionTitles: [],
      createdBy: activity.personId?.toString() || '',
      createdAt: activity.createdAt?.toISOString().split('T')[0] || '',
    };
  }

  async createActivity(
    user: AuthenticatedDirector,
    dto: UpsertTeacherActivityDto,
  ): Promise<TeacherActivityItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const activity = await this.prisma.activity.create({
      data: {
        title: dto.title,
        content: dto.content,
        date: dto.date,
        personId: user.personId,
        image: dto.image ?? '',
      },
    });

    return {
      id: activity.id,
      date: activity.date?.toISOString().split('T')[0],
      title: activity.title,
      description: activity.content,
      startDate: activity.date?.toISOString().split('T')[0] || '',
      endDate: '',
      courseTitle: '',
      gradeLevels: [],
      sectionTitles: [],
      createdBy: activity.personId?.toString() || '',
      createdAt: activity.createdAt?.toISOString().split('T')[0] || '',
    };
  }

  async updateActivity(
    user: AuthenticatedDirector,
    activityId: number,
    dto: UpsertTeacherActivityDto,
  ): Promise<TeacherActivityItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const activity = await this.prisma.activity.findFirst({
      where: {
        id: activityId,
      },
      include: activityInclude,
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    const updated = await this.prisma.activity.update({
      where: { id: activityId },
      data: {
        title: dto.title,
        content: dto.content,
        date: dto.date,
        image: dto.image ?? activity.image,
      },
    });

    return {
      id: updated.id,
      date: updated.date?.toISOString().split('T')[0],
      title: updated.title,
      description: updated.content,
      startDate: updated.date?.toISOString().split('T')[0] || '',
      endDate: '',
      courseTitle: '',
      gradeLevels: [],
      sectionTitles: [],
      createdBy: updated.personId?.toString() || '',
      createdAt: updated.createdAt?.toISOString().split('T')[0] || '',
    };
  }

  async deleteActivity(
    user: AuthenticatedDirector,
    activityId: number,
  ): Promise<boolean> {
    this.directorAccess.ensureDirectorRole(user.role);

    const activity = await this.prisma.activity.findFirst({
      where: {
        id: activityId,
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    await this.prisma.activity.delete({
      where: { id: activityId },
    });

    return true;
  }
}
