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
  TeacherActivitiesQueryDto,
  TeacherActivitiesResponseDto,
  TeacherActivityItemDto,
} from './dto/teacher-media.dto';
import { formatDateOnly } from './teacher.util';

const DASHBOARD_CREATOR_PERSON_ID = 1;

const activityInclude = {
  year: { select: { id: true, title: true, schoolId: true } },
} as const;

type ActivityRecord = Prisma.ActivityGetPayload<{
  include: typeof activityInclude;
}>;

@Injectable()
export class TeacherActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAccess: TeacherAccessService,
  ) {}

  async listActivities(
    user: AuthenticatedTeacher,
    query: TeacherActivitiesQueryDto,
  ): Promise<TeacherActivitiesResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 20,
    });
    const where = await this.buildWhere(user);
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
      items: rows.map((row) => this.toItem(row)),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getActivity(
    user: AuthenticatedTeacher,
    activityId: number,
  ): Promise<TeacherActivityItemDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const where = await this.buildWhere(user);
    const row = await this.prisma.activity.findFirst({
      where: { ...where, id: activityId },
      include: activityInclude,
    });
    if (!row) {
      throw new NotFoundException('Activity not found');
    }
    return this.toItem(row);
  }

  private async buildWhere(
    user: AuthenticatedTeacher,
  ): Promise<Prisma.ActivityWhereInput> {
    const yearIds = await this.taughtYearIds(user);
    return {
      deletedAt: null,
      OR: [
        ...(yearIds.length > 0
          ? [{ year: { schoolId: user.schoolId }, yearId: { in: yearIds } }]
          : []),
        { yearId: null, person: { schoolId: user.schoolId } },
        { yearId: null, personId: DASHBOARD_CREATOR_PERSON_ID },
      ],
    };
  }

  private async taughtYearIds(user: AuthenticatedTeacher): Promise<number[]> {
    const rows = await this.prisma.teach.findMany({
      where: {
        teacherId: user.teacherId,
        section: { schoolId: user.schoolId },
      },
      select: { yearId: true },
    });
    return [...new Set(rows.map((row) => row.yearId))];
  }

  private toItem(row: ActivityRecord): TeacherActivityItemDto {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      date: formatDateOnly(row.date),
      image: row.image || '',
      isGlobal: row.yearId == null,
      scopeLabel: row.year?.title || 'All school',
    };
  }
}
