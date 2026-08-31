import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DashboardExamScheduleDetailResponseDto } from './dto/dashboard-exam-schedule-detail-response.dto';
import { DashboardExamSchedulesQueryDto } from './dto/dashboard-exam-schedules-query.dto';
import {
  DashboardExamScheduleItemDto,
  DashboardExamSchedulesResponseDto,
} from './dto/dashboard-exam-schedules-response.dto';
import { DashboardGradeTypesResponseDto } from './dto/dashboard-grade-types-response.dto';
import { SaveDashboardExamScheduleDto } from './dto/save-dashboard-exam-schedule.dto';

const DASHBOARD_CREATOR_PERSON_ID = 1;

const examScheduleDetailInclude = {
  class: { select: { className: true } },
  year: { select: { id: true, title: true } },
  gradeType: { select: { id: true, title: true } },
  person: {
    select: {
      firstName: true,
      middleName: true,
      lastName: true,
    },
  },
  dates: {
    where: { status: true },
    orderBy: { date: 'asc' as const },
    include: {
      details: {
        where: { status: true },
        orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
        include: {
          course: { select: { title: true } },
        },
      },
    },
  },
};

@Injectable()
export class DashboardExamSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async listGradeTypes(
    user: AuthenticatedSchool,
  ): Promise<DashboardGradeTypesResponseDto> {
    const items = await this.prisma.gradeType.findMany({
      where: {
        status: true,
        OR: [{ schoolId: user.schoolId }, { schoolId: null }],
      },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { id: true, title: true },
    });

    return { items };
  }

  async listExamSchedules(
    user: AuthenticatedSchool,
    query: DashboardExamSchedulesQueryDto,
  ): Promise<DashboardExamSchedulesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const yearId =
      query.yearId ?? (await this.currentYearId(user.schoolId));
    const where = this.buildScheduleWhere(user.schoolId, {
      ...query,
      yearId: yearId ?? undefined,
    });
    const orderBy = this.buildScheduleOrderBy(query.sortBy, query.sortOrder);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.examSchedule.count({ where }),
      this.prisma.examSchedule.findMany({
        where,
        include: {
          class: { select: { className: true } },
          year: { select: { id: true, title: true } },
          gradeType: { select: { title: true } },
          person: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toScheduleItem(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getExamSchedule(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardExamScheduleDetailResponseDto> {
    const schedule = await this.findScheduleForSchool(user.schoolId, id);
    return this.toScheduleDetail(schedule);
  }

  async createExamSchedule(
    user: AuthenticatedSchool,
    body: SaveDashboardExamScheduleDto,
  ): Promise<DashboardExamScheduleDetailResponseDto> {
    await this.assertCreatorPersonExists();
    const yearId =
      body.yearId ?? (await this.currentYearId(user.schoolId));
    if (!yearId) {
      throw new BadRequestException('Year is required');
    }

    await this.validateSaveBody(user.schoolId, body, yearId);

    const schedule = await this.prisma.$transaction(async (tx) => {
      const created = await tx.examSchedule.create({
        data: {
          title: body.title,
          classId: body.classId,
          yearId,
          gradeTypeId: body.gradeTypeId,
          personId: DASHBOARD_CREATOR_PERSON_ID,
          note: body.note?.trim() || null,
        },
      });

      await this.createDates(tx, created.id, body.dates);
      return created.id;
    });

    return this.getExamSchedule(user, schedule);
  }

  async updateExamSchedule(
    user: AuthenticatedSchool,
    id: number,
    body: SaveDashboardExamScheduleDto,
  ): Promise<DashboardExamScheduleDetailResponseDto> {
    const existing = await this.findScheduleForSchool(user.schoolId, id);
    const yearId = body.yearId ?? existing.year.id;
    await this.validateSaveBody(user.schoolId, body, yearId);

    await this.prisma.$transaction(async (tx) => {
      await tx.examDate.deleteMany({ where: { examScheduleId: id } });
      await tx.examSchedule.update({
        where: { id },
        data: {
          title: body.title,
          classId: body.classId,
          yearId,
          gradeTypeId: body.gradeTypeId,
          note: body.note?.trim() || null,
        },
      });
      await this.createDates(tx, id, body.dates);
    });

    return this.getExamSchedule(user, id);
  }

  async deleteExamSchedule(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<void> {
    await this.findScheduleForSchool(user.schoolId, id);
    await this.prisma.examSchedule.delete({ where: { id } });
  }

  private async findScheduleForSchool(schoolId: number, id: number) {
    const schedule = await this.prisma.examSchedule.findFirst({
      where: {
        id,
        status: true,
        year: { schoolId },
      },
      include: examScheduleDetailInclude,
    });

    if (!schedule) {
      throw new NotFoundException('Exam schedule not found');
    }

    return schedule;
  }

  private async validateSaveBody(
    schoolId: number,
    body: SaveDashboardExamScheduleDto,
    yearId: number,
  ): Promise<void> {
    const section = await this.prisma.section.findFirst({
      where: {
        classId: body.classId,
        schoolId,
        yearId,
      },
      select: { id: true },
    });
    if (!section) {
      throw new BadRequestException(
        'Class not found for this school and year',
      );
    }

    const gradeType = await this.prisma.gradeType.findFirst({
      where: {
        id: body.gradeTypeId,
        status: true,
        OR: [{ schoolId }, { schoolId: null }],
      },
      select: { id: true },
    });
    if (!gradeType) {
      throw new BadRequestException('Grade type not found');
    }

    const allowedCourseIds = new Set(
      (
        await this.prisma.classCourse.findMany({
          where: {
            classId: body.classId,
            yearId,
            status: true,
          },
          select: { courseId: true },
        })
      ).map((item) => item.courseId),
    );

    for (const examDate of body.dates) {
      for (const exam of examDate.exams) {
        if (!allowedCourseIds.has(exam.courseId)) {
          throw new BadRequestException(
            `Course ${exam.courseId} is not assigned to this class`,
          );
        }
      }
    }
  }

  private async createDates(
    tx: Prisma.TransactionClient,
    examScheduleId: number,
    dates: SaveDashboardExamScheduleDto['dates'],
  ): Promise<void> {
    for (const examDate of dates) {
      const createdDate = await tx.examDate.create({
        data: {
          examScheduleId,
          date: new Date(`${examDate.date}T00:00:00.000Z`),
        },
      });

      const exams = examDate.exams.map((exam, index) => ({
        examDateId: createdDate.id,
        courseId: exam.courseId,
        position: exam.position ?? index,
        startTime: exam.startTime,
        duration: exam.duration,
        note: exam.note?.trim() || null,
      }));

      if (exams.length > 0) {
        await tx.examScheduleDetail.createMany({ data: exams });
      }
    }
  }

  private toScheduleItem(schedule: {
    id: number;
    classId: number;
    yearId: number;
    gradeTypeId: number;
    title: string;
    createdAt: Date;
    class: { className: string };
    year: { title: string };
    gradeType: { title: string };
    person: {
      firstName: string;
      middleName: string;
      lastName: string;
    };
  }): DashboardExamScheduleItemDto {
    return {
      id: schedule.id,
      title: schedule.title,
      classId: schedule.classId,
      className: schedule.class.className,
      yearId: schedule.yearId,
      yearTitle: schedule.year.title,
      gradeTypeId: schedule.gradeTypeId,
      gradeTypeTitle: schedule.gradeType.title,
      createdAt: schedule.createdAt.toISOString(),
      createdByName: this.formatPersonName(schedule.person),
    };
  }

  private toScheduleDetail(schedule: {
    id: number;
    title: string;
    classId: number;
    note: string | null;
    class: { className: string };
    year: { id: number; title: string };
    gradeType: { id: number; title: string };
    dates: Array<{
      id: number;
      date: Date;
      details: Array<{
        id: number;
        courseId: number;
        position: number;
        startTime: string;
        duration: number;
        note: string | null;
        course: { title: string };
      }>;
    }>;
  }): DashboardExamScheduleDetailResponseDto {
    return {
      id: schedule.id,
      title: schedule.title,
      classId: schedule.classId,
      className: schedule.class.className,
      yearId: schedule.year.id,
      yearTitle: schedule.year.title,
      gradeTypeId: schedule.gradeType.id,
      gradeTypeTitle: schedule.gradeType.title,
      note: schedule.note,
      dates: schedule.dates.map((examDate) => ({
        id: examDate.id,
        date: this.formatDateOnly(examDate.date),
        exams: examDate.details.map((detail) => ({
          id: detail.id,
          courseId: detail.courseId,
          courseTitle: detail.course.title,
          position: detail.position,
          startTime: detail.startTime,
          duration: detail.duration,
          note: detail.note,
        })),
      })),
    };
  }

  private buildScheduleWhere(
    schoolId: number,
    query: DashboardExamSchedulesQueryDto,
  ): Prisma.ExamScheduleWhereInput {
    const search = query.search?.trim();

    return {
      status: true,
      year: { schoolId },
      ...(query.yearId ? { yearId: query.yearId } : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              {
                class: {
                  className: { contains: search, mode: 'insensitive' },
                },
              },
              {
                gradeType: {
                  title: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
  }

  private buildScheduleOrderBy(
    sortBy?: DashboardExamSchedulesQueryDto['sortBy'],
    sortOrder?: DashboardExamSchedulesQueryDto['sortOrder'],
  ): Prisma.ExamScheduleOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder = sortOrder === 'desc' ? 'desc' : 'asc';
    const idTieBreaker: Prisma.ExamScheduleOrderByWithRelationInput = {
      id: direction,
    };

    switch (sortBy) {
      case 'title':
        return [{ title: direction }, idTieBreaker];
      case 'class':
        return [{ class: { className: direction } }, idTieBreaker];
      case 'gradeType':
        return [{ gradeType: { title: direction } }, idTieBreaker];
      case 'year':
        return [{ year: { title: direction } }, idTieBreaker];
      case 'date':
        return [{ createdAt: direction }, idTieBreaker];
      case 'id':
      default:
        return [{ id: direction }];
    }
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

  private formatDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private async currentYearId(schoolId: number): Promise<number | null> {
    const year = await this.prisma.year.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });
    return year?.id ?? null;
  }

  private async assertCreatorPersonExists(): Promise<void> {
    const person = await this.prisma.person.findUnique({
      where: { id: DASHBOARD_CREATOR_PERSON_ID },
      select: { id: true },
    });
    if (!person) {
      throw new NotFoundException('Creator person not found');
    }
  }
}
