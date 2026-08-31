import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DashboardWeeklyScheduleGridQueryDto } from './dto/dashboard-weekly-schedules-grid-query.dto';
import {
  DashboardWeeklyScheduleGridCellDto,
  DashboardWeeklyScheduleGridResponseDto,
} from './dto/dashboard-weekly-schedules-grid-response.dto';
import { SaveDashboardWeeklyScheduleDto } from './dto/save-dashboard-weekly-schedule.dto';
import { DashboardWeeklySchedulesQueryDto } from './dto/dashboard-weekly-schedules-query.dto';
import {
  DashboardWeeklyScheduleItemDto,
  DashboardWeeklySchedulesResponseDto,
} from './dto/dashboard-weekly-schedules-response.dto';

const detailInclude = {
  day: { select: { dayName: true, position: true } },
  session: { select: { sessionName: true, position: true } },
  course: { select: { id: true, title: true } },
  person: {
    select: { id: true, firstName: true, middleName: true, lastName: true },
  },
  schedule: {
    select: {
      section: {
        select: {
          id: true,
          classId: true,
          yearId: true,
          class: { select: { className: true } },
          sectionTitle: { select: { title: true } },
          year: { select: { id: true, title: true } },
        },
      },
    },
  },
} as const;

type ScheduleDetailRecord = {
  id: number;
  courseId: number;
  personId: number | null;
  day: { dayName: string; position: number };
  session: { sessionName: string; position: number };
  course: { id: number; title: string };
  person: {
    id: number;
    firstName: string;
    middleName: string;
    lastName: string;
  } | null;
  schedule: {
    section: {
      id: number;
      classId: number;
      yearId: number;
      class: { className: string };
      sectionTitle: { title: string };
      year: { id: number; title: string };
    };
  };
};

@Injectable()
export class DashboardWeeklySchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async listWeeklySchedules(
    user: AuthenticatedSchool,
    query: DashboardWeeklySchedulesQueryDto,
  ): Promise<DashboardWeeklySchedulesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const yearId =
      query.yearId ?? (await this.currentYearId(user.schoolId));
    const where = this.buildWhere(user.schoolId, {
      ...query,
      yearId: yearId ?? undefined,
    });
    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.weeklyScheduleDetail.count({ where }),
      this.prisma.weeklyScheduleDetail.findMany({
        where,
        include: detailInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) =>
        this.toItem(row as unknown as ScheduleDetailRecord),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getWeeklyScheduleGrid(
    user: AuthenticatedSchool,
    query: DashboardWeeklyScheduleGridQueryDto,
  ): Promise<DashboardWeeklyScheduleGridResponseDto> {
    if (!query.sectionId) {
      throw new BadRequestException('Section is required');
    }

    const yearId =
      query.yearId ?? (await this.currentYearId(user.schoolId));
    if (!yearId) {
      throw new BadRequestException('Year is required');
    }

    const section = await this.prisma.section.findFirst({
      where: {
        id: query.sectionId,
        schoolId: user.schoolId,
        yearId,
        ...(query.classId ? { classId: query.classId } : {}),
      },
      include: {
        class: { select: { className: true } },
        sectionTitle: { select: { title: true } },
        year: { select: { title: true } },
      },
    });

    if (!section) {
      throw new NotFoundException('Section not found for this year and class');
    }

    const [days, sessions, schedule] = await Promise.all([
      this.prisma.day.findMany({
        where: { schoolId: user.schoolId },
        orderBy: { position: 'asc' },
        select: { id: true, dayName: true, position: true },
      }),
      this.prisma.session.findMany({
        where: { schoolId: user.schoolId, status: true },
        orderBy: { position: 'asc' },
        select: { id: true, sessionName: true, position: true },
      }),
      this.prisma.weeklySchedule.findFirst({
        where: { sectionId: section.id },
        include: {
          details: {
            include: {
              day: { select: { id: true } },
              session: { select: { id: true } },
              course: { select: { id: true, title: true } },
              person: {
                select: {
                  id: true,
                  firstName: true,
                  middleName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const detailByKey = new Map<
      string,
      NonNullable<typeof schedule>["details"][number]
    >();
    for (const detail of schedule?.details ?? []) {
      detailByKey.set(`${detail.dayId}:${detail.sessionId}`, detail);
    }

    const cells: DashboardWeeklyScheduleGridCellDto[] = [];
    for (const session of sessions) {
      for (const day of days) {
        const detail = detailByKey.get(`${day.id}:${session.id}`);
        cells.push({
          dayId: day.id,
          sessionId: session.id,
          detailId: detail?.id ?? null,
          courseId: detail?.courseId ?? null,
          courseTitle: detail?.course.title ?? null,
          personId: detail?.personId ?? null,
          createdByName: detail?.person
            ? this.formatPersonName(detail.person)
            : null,
        });
      }
    }

    return {
      scheduleId: schedule?.id ?? null,
      yearTitle: section.year.title,
      className: section.class.className,
      sectionTitle: section.sectionTitle.title,
      days,
      sessions,
      cells,
    };
  }

  async saveWeeklySchedule(
    user: AuthenticatedSchool,
    body: SaveDashboardWeeklyScheduleDto,
  ): Promise<DashboardWeeklyScheduleGridResponseDto> {
    const yearId =
      body.yearId ?? (await this.currentYearId(user.schoolId));
    if (!yearId) {
      throw new BadRequestException('Year is required');
    }

    const section = await this.prisma.section.findFirst({
      where: {
        id: body.sectionId,
        schoolId: user.schoolId,
        yearId,
        ...(body.classId ? { classId: body.classId } : {}),
      },
      select: { id: true, classId: true },
    });

    if (!section) {
      throw new NotFoundException('Section not found for this year and class');
    }

    const slotKeys = new Set<string>();
    for (const entry of body.entries) {
      const key = `${entry.dayId}:${entry.sessionId}`;
      if (slotKeys.has(key)) {
        throw new BadRequestException(
          'Each day and session can only appear once in the schedule',
        );
      }
      slotKeys.add(key);
    }

    const [days, sessions, courses, classCourses] = await Promise.all([
      this.prisma.day.findMany({
        where: { schoolId: user.schoolId },
        select: { id: true },
      }),
      this.prisma.session.findMany({
        where: { schoolId: user.schoolId, status: true },
        select: { id: true },
      }),
      this.prisma.course.findMany({
        where: { schoolId: user.schoolId },
        select: { id: true },
      }),
      this.prisma.classCourse.findMany({
        where: {
          classId: section.classId,
          yearId,
          status: true,
        },
        select: { courseId: true },
      }),
    ]);

    const dayIds = new Set(days.map((day) => day.id));
    const sessionIds = new Set(sessions.map((session) => session.id));
    const courseIds = new Set(courses.map((course) => course.id));
    const classCourseIds = new Set(classCourses.map((item) => item.courseId));

    for (const entry of body.entries) {
      if (!dayIds.has(entry.dayId)) {
        throw new BadRequestException(`Invalid day id ${entry.dayId}`);
      }
      if (!sessionIds.has(entry.sessionId)) {
        throw new BadRequestException(`Invalid session id ${entry.sessionId}`);
      }
      if (!courseIds.has(entry.courseId)) {
        throw new BadRequestException(`Invalid course id ${entry.courseId}`);
      }
      if (!classCourseIds.has(entry.courseId)) {
        throw new BadRequestException(
          `Course ${entry.courseId} is not assigned to this class`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      let schedule = await tx.weeklySchedule.findFirst({
        where: { sectionId: section.id },
      });

      if (!schedule) {
        schedule = await tx.weeklySchedule.create({
          data: { sectionId: section.id },
        });
      } else {
        await tx.weeklyScheduleDetail.deleteMany({
          where: { scheduleId: schedule.id },
        });
      }

      if (body.entries.length > 0) {
        await tx.weeklyScheduleDetail.createMany({
          data: body.entries.map((entry) => ({
            scheduleId: schedule!.id,
            dayId: entry.dayId,
            sessionId: entry.sessionId,
            courseId: entry.courseId,
          })),
        });
      }
    });

    return this.getWeeklyScheduleGrid(user, {
      sectionId: body.sectionId,
      yearId,
      classId: body.classId ?? section.classId,
    });
  }

  private toItem(row: ScheduleDetailRecord): DashboardWeeklyScheduleItemDto {
    const section = row.schedule.section;

    return {
      id: row.id,
      yearId: section.yearId,
      yearTitle: section.year.title,
      classId: section.classId,
      className: section.class.className,
      sectionId: section.id,
      sectionTitle: section.sectionTitle.title,
      dayName: row.day.dayName,
      sessionName: row.session.sessionName,
      courseId: row.courseId,
      courseTitle: row.course.title,
      personId: row.personId,
      createdByName: row.person ? this.formatPersonName(row.person) : null,
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

  private async currentYearId(schoolId: number): Promise<number | null> {
    const year = await this.prisma.year.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });
    return year?.id ?? null;
  }

  private buildWhere(
    schoolId: number,
    query: DashboardWeeklySchedulesQueryDto,
  ): Prisma.WeeklyScheduleDetailWhereInput {
    const search = query.search?.trim();

    return {
      course: { schoolId },
      schedule: {
        section: {
          schoolId,
          ...(query.yearId ? { yearId: query.yearId } : {}),
          ...(query.classId ? { classId: query.classId } : {}),
          ...(query.sectionId ? { id: query.sectionId } : {}),
        },
      },
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(search
        ? {
            OR: [
              { course: { title: { contains: search, mode: 'insensitive' } } },
              {
                schedule: {
                  section: {
                    class: {
                      className: { contains: search, mode: 'insensitive' },
                    },
                  },
                },
              },
              {
                person: {
                  OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { middleName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    sortBy?: DashboardWeeklySchedulesQueryDto['sortBy'],
    sortOrder?: DashboardWeeklySchedulesQueryDto['sortOrder'],
  ): Prisma.WeeklyScheduleDetailOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder = sortOrder === 'desc' ? 'desc' : 'asc';
    const idTieBreaker: Prisma.WeeklyScheduleDetailOrderByWithRelationInput = {
      id: direction,
    };

    switch (sortBy) {
      case 'year':
        return [{ schedule: { section: { year: { title: direction } } } }, idTieBreaker];
      case 'class':
        return [
          { schedule: { section: { class: { className: direction } } } },
          idTieBreaker,
        ];
      case 'section':
        return [
          { schedule: { section: { sectionTitle: { title: direction } } } },
          idTieBreaker,
        ];
      case 'day':
        return [{ day: { position: direction } }, idTieBreaker];
      case 'session':
        return [{ session: { position: direction } }, idTieBreaker];
      case 'course':
        return [{ course: { title: direction } }, idTieBreaker];
      case 'createdBy':
        return [{ person: { firstName: direction } }, idTieBreaker];
      case 'id':
      default:
        return [{ id: direction }];
    }
  }
}
