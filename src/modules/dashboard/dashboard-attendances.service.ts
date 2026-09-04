import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DashboardAttendancesQueryDto } from './dto/dashboard-attendances-query.dto';
import {
  DashboardAttendanceDetailResponseDto,
  DashboardAttendanceSheetDto,
  DashboardAttendancesResponseDto,
} from './dto/dashboard-attendances-response.dto';
import { SaveDashboardAttendanceDto } from './dto/save-dashboard-attendance.dto';

const DASHBOARD_CREATOR_PERSON_ID = 1;

@Injectable()
export class DashboardAttendancesService {
  constructor(private readonly prisma: PrismaService) {}

  async listAttendances(
    user: AuthenticatedSchool,
    query: DashboardAttendancesQueryDto,
  ): Promise<DashboardAttendancesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = query.sortBy ?? 'date';
    const sortOrder = query.sortOrder ?? 'desc';
    const where = this.buildWhere(user.schoolId, query);

    const orderBy = this.buildOrderBy(sortBy, sortOrder);

    const [rows, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        include: {
          section: {
            include: {
              class: { select: { id: true, className: true } },
              year: { select: { id: true, title: true } },
              sectionTitle: { select: { title: true } },
            },
          },
          details: {
            where: { deletedAt: null },
            select: { status: true },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        date: this.formatDate(row.date),
        sectionId: row.sectionId,
        sectionTitle: row.section.sectionTitle.title,
        classId: row.section.class.id,
        className: row.section.class.className,
        yearId: row.section.year.id,
        yearTitle: row.section.year.title,
        status: row.status,
        studentCount: row.details.length,
        absentCount: row.details.filter((d) => d.status === 'absent').length,
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getAttendanceSheet(
    user: AuthenticatedSchool,
    sectionId: number,
    date: string,
  ): Promise<DashboardAttendanceSheetDto> {
    const section = await this.findSectionForSchool(user.schoolId, sectionId);
    const day = this.parseDateOnly(date);

    const [registrations, existing] = await Promise.all([
      this.prisma.registration.findMany({
        where: {
          schoolId: user.schoolId,
          sectionId,
          status: true,
        },
        include: {
          student: {
            include: {
              person: {
                select: { firstName: true, middleName: true, lastName: true },
              },
            },
          },
        },
        orderBy: [{ id: 'asc' }],
      }),
      this.prisma.attendance.findFirst({
        where: {
          sectionId,
          date: day,
          deletedAt: null,
          section: { schoolId: user.schoolId },
        },
        include: {
          details: {
            where: { deletedAt: null },
          },
        },
      }),
    ]);

    const detailByStudent = new Map(
      (existing?.details ?? []).map((detail) => [detail.studentId, detail]),
    );

    return {
      attendanceId: existing?.id ?? null,
      date: this.formatDate(day),
      sectionId: section.id,
      sectionTitle: section.sectionTitle.title,
      classId: section.class.id,
      className: section.class.className,
      yearId: section.year.id,
      yearTitle: section.year.title,
      students: registrations.map((registration) => {
        const detail = detailByStudent.get(registration.studentId);
        return {
          studentId: registration.studentId,
          registrationId: registration.id,
          studentName: this.formatPersonName(registration.student.person),
          status: (detail?.status ?? 'present') as
            | 'present'
            | 'absent'
            | 'late'
            | 'excused',
          description: detail?.description ?? null,
        };
      }),
    };
  }

  async getAttendance(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardAttendanceDetailResponseDto> {
    const row = await this.prisma.attendance.findFirst({
      where: {
        id,
        deletedAt: null,
        section: { schoolId: user.schoolId },
      },
      include: {
        section: {
          include: {
            class: { select: { id: true, className: true } },
            year: { select: { id: true, title: true } },
            sectionTitle: { select: { title: true } },
          },
        },
        details: {
          where: { deletedAt: null },
          include: {
            student: {
              include: {
                person: {
                  select: {
                    firstName: true,
                    middleName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException('Attendance not found');
    }

    const registrations = await this.prisma.registration.findMany({
      where: {
        schoolId: user.schoolId,
        sectionId: row.sectionId,
        status: true,
      },
      select: { id: true, studentId: true },
    });
    const registrationByStudent = new Map(
      registrations.map((item) => [item.studentId, item.id]),
    );

    return {
      attendanceId: row.id,
      date: this.formatDate(row.date),
      sectionId: row.sectionId,
      sectionTitle: row.section.sectionTitle.title,
      classId: row.section.class.id,
      className: row.section.class.className,
      yearId: row.section.year.id,
      yearTitle: row.section.year.title,
      status: row.status,
      students: row.details.map((detail) => ({
        studentId: detail.studentId,
        registrationId: registrationByStudent.get(detail.studentId) ?? 0,
        studentName: this.formatPersonName(detail.student.person),
        status: detail.status,
        description: detail.description ?? null,
      })),
    };
  }

  async saveAttendance(
    user: AuthenticatedSchool,
    body: SaveDashboardAttendanceDto,
  ): Promise<DashboardAttendanceDetailResponseDto> {
    await this.assertCreatorPersonExists();
    const section = await this.findSectionForSchool(
      user.schoolId,
      body.sectionId,
    );
    const day = this.parseDateOnly(body.date);

    const studentIds = body.details.map((item) => item.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw new BadRequestException('Duplicate students in attendance details');
    }

    const registrations = await this.prisma.registration.findMany({
      where: {
        schoolId: user.schoolId,
        sectionId: body.sectionId,
        studentId: { in: studentIds },
        status: true,
      },
      select: { studentId: true },
    });
    const allowed = new Set(registrations.map((item) => item.studentId));
    for (const studentId of studentIds) {
      if (!allowed.has(studentId)) {
        throw new BadRequestException(
          `Student ${studentId} is not registered in this section`,
        );
      }
    }

    for (const detail of body.details) {
      if (
        detail.status === 'absent' &&
        (!detail.description || !detail.description.trim())
      ) {
        throw new BadRequestException(
          'Reason is required when a student is absent',
        );
      }
    }

    const existing = await this.prisma.attendance.findFirst({
      where: {
        sectionId: body.sectionId,
        date: day,
        deletedAt: null,
      },
      select: { id: true },
    });

    const attendanceId = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.attendanceDetail.deleteMany({
          where: { attendanceId: existing.id },
        });
        await tx.attendance.update({
          where: { id: existing.id },
          data: {
            status: true,
            personId: DASHBOARD_CREATOR_PERSON_ID,
          },
        });
        await tx.attendanceDetail.createMany({
          data: body.details.map((detail) => ({
            attendanceId: existing.id,
            studentId: detail.studentId,
            status: detail.status as AttendanceStatus,
            description:
              detail.status === 'absent'
                ? detail.description?.trim() || null
                : null,
          })),
        });
        return existing.id;
      }

      const created = await tx.attendance.create({
        data: {
          date: day,
          sectionId: section.id,
          personId: DASHBOARD_CREATOR_PERSON_ID,
          status: true,
          details: {
            create: body.details.map((detail) => ({
              studentId: detail.studentId,
              status: detail.status as AttendanceStatus,
              description:
                detail.status === 'absent'
                  ? detail.description?.trim() || null
                  : null,
            })),
          },
        },
        select: { id: true },
      });
      return created.id;
    });

    return this.getAttendance(user, attendanceId);
  }

  async deleteAttendance(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<void> {
    const row = await this.prisma.attendance.findFirst({
      where: {
        id,
        deletedAt: null,
        section: { schoolId: user.schoolId },
      },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Attendance not found');
    }

    await this.prisma.attendance.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: false,
      },
    });
  }

  private buildWhere(
    schoolId: number,
    query: DashboardAttendancesQueryDto,
  ): Prisma.AttendanceWhereInput {
    const where: Prisma.AttendanceWhereInput = {
      deletedAt: null,
      section: {
        schoolId,
        ...(query.yearId ? { yearId: query.yearId } : {}),
        ...(query.classId ? { classId: query.classId } : {}),
      },
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    };

    if (query.date) {
      where.date = this.parseDateOnly(query.date);
    }

    if (query.search) {
      where.OR = [
        {
          section: {
            class: {
              className: { contains: query.search, mode: 'insensitive' },
            },
          },
        },
        {
          section: {
            sectionTitle: {
              title: { contains: query.search, mode: 'insensitive' },
            },
          },
        },
        {
          section: {
            year: {
              title: { contains: query.search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    return where;
  }

  private buildOrderBy(
    sortBy: NonNullable<DashboardAttendancesQueryDto['sortBy']>,
    sortOrder: 'asc' | 'desc',
  ): Prisma.AttendanceOrderByWithRelationInput {
    switch (sortBy) {
      case 'class':
        return { section: { class: { className: sortOrder } } };
      case 'section':
        return { section: { sectionTitle: { title: sortOrder } } };
      case 'year':
        return { section: { year: { title: sortOrder } } };
      case 'status':
        return { status: sortOrder };
      case 'id':
        return { id: sortOrder };
      case 'date':
      default:
        return { date: sortOrder };
    }
  }

  private async findSectionForSchool(schoolId: number, sectionId: number) {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, schoolId },
      include: {
        class: { select: { id: true, className: true } },
        year: { select: { id: true, title: true } },
        sectionTitle: { select: { title: true } },
      },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    return section;
  }

  private parseDateOnly(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) {
      throw new BadRequestException('Date must be YYYY-MM-DD');
    }
    const date = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    );
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    return date;
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
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

  private async assertCreatorPersonExists(): Promise<void> {
    const person = await this.prisma.person.findUnique({
      where: { id: DASHBOARD_CREATOR_PERSON_ID },
      select: { id: true },
    });
    if (!person) {
      throw new BadRequestException('Creator person not found');
    }
  }
}
