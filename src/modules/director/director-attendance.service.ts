import { Injectable, ForbiddenException } from '@nestjs/common';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DirectorAccessService } from './director-access.service';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import {
  TeacherAttendanceSheetDto,
  DirectorAttendanceOptionsDto,
  DirectorAttendancesQueryDto,
  DirectorAttendanceSheetQueryDto,
} from './dto/director-attendance.dto';

@Injectable()
export class DirectorAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directorAccess: DirectorAccessService,
  ) {}

  async listOptions(
    user: AuthenticatedDirector,
  ): Promise<DirectorAttendanceOptionsDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const school = await this.prisma.school.findUnique({
      where: { id: user.schoolId },
    });

    if (!school) {
      throw new ForbiddenException('School not found');
    }

    const { total: _, sections } = await this.directorAccess.listSectionsInSchool(
      user.schoolId,
    );

    const classes: any[] = [];
    const seen = new Set<string>();

    for (const section of sections) {
      const key = String(section.class.id);
      if (!seen.has(key)) {
        seen.add(key);
        classes.push({
          id: section.class.id,
          name: section.class.className,
          sections: [],
        });
      }
      const existingClass = classes.find((c) => c.id === section.class.id);
      if (existingClass) {
        existingClass.sections.push({
          id: section.id,
          title: section.sectionTitle.title,
        });
      }
    }

    return {
      attendancePerCourse: school.attendancePerCourse === true,
      canTakeAttendance: true,
      defaultClassId: classes.length > 0 ? classes[0].id : 1,
      defaultSectionId: classes.length > 0 ? classes[0].sections[0]?.id : 1,
      defaultCourseId: null,
      classes,
    };
  }

  async listAttendances(user: AuthenticatedDirector, query: DirectorAttendancesQueryDto) {
    this.directorAccess.ensureDirectorRole(user.role);
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit ?? 20 });
    const { sections } = await this.directorAccess.listSectionsInSchool(user.schoolId);
    const sectionIds = sections.map((section) => section.id);
    if (sectionIds.length === 0) {
      return { items: [], pagination: buildPaginationMeta(page, limit, 0) };
    }
    const where = {
      deletedAt: null,
      sectionId: { in: sectionIds },
      ...(query.date ? { date: new Date(query.date) } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.findMany({
        where,
        include: {
          section: {
            select: {
              class: { select: { className: true } },
              sectionTitle: { select: { title: true } },
            },
          },
          course: { select: { id: true, title: true } },
          details: { where: { deletedAt: null }, select: { status: true } },
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        date: row.date.toISOString().split('T')[0],
        sectionId: row.sectionId ?? 0,
        classLabel: row.section ? `${row.section.class.className} - ${row.section.sectionTitle.title}` : '',
        courseId: row.course?.id ?? null,
        courseTitle: row.course?.title ?? null,
        studentCount: row.details.length,
        absentCount: row.details.filter((detail) => detail.status === 'absent').length,
      })),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getSheet(
    user: AuthenticatedDirector,
    query: DirectorAttendanceSheetQueryDto,
  ): Promise<TeacherAttendanceSheetDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const day = query.date ? new Date(query.date) : new Date();
    const sectionId = Number(query.sectionId);

    const section = await this.directorAccess.resolveSectionInSchool(
      user.schoolId,
      sectionId,
    );

    const registrations = await this.prisma.registration.findMany({
      where: { sectionId, schoolId: user.schoolId, status: true },
      include: {
        student: {
          select: {
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
    });

    const existingAttendance = await this.prisma.attendance.findFirst({
      where: {
        sectionId,
        date: day,
        deletedAt: null,
        ...(query.courseId != null ? { courseId: Number(query.courseId) } : {}),
      },
      include: {
        details: {
          where: { deletedAt: null },
          include: {
            attendanceReason: { select: { id: true, title: true } },
          },
        },
      },
    });

    const detailsByStudent = new Map(
      (existingAttendance?.details ?? []).map((detail) => [detail.studentId, detail]),
    );
    return {
      attendanceId: existingAttendance?.id ?? 0,
      date: day.toISOString().split('T')[0],
      sectionId,
      classLabel: section
        ? section.class.className + ' - ' + section.sectionTitle.title
        : '',
      courseTitle: null,
      students: registrations.map((registration) => {
        return {
          studentId: registration.studentId,
          registrationId: registration.id,
          studentName: registration.student.person
            ? registration.student.person.firstName + ' ' + (registration.student.person.middleName || '') + ' ' + registration.student.person.lastName
            : '',
          status: detailsByStudent.get(registration.studentId)?.status ?? 'present',
          attendanceReasonId: detailsByStudent.get(registration.studentId)?.attendanceReason?.id ?? null,
          attendanceReasonTitle: detailsByStudent.get(registration.studentId)?.attendanceReason?.title ?? null,
          description: detailsByStudent.get(registration.studentId)?.description ?? null,
        };
      }),
    };
  }

  async saveAttendance(
    user: AuthenticatedDirector,
    dto: any,
  ): Promise<TeacherAttendanceSheetDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const day = new Date(dto.date);
    const sectionId = dto.sectionId;

    const section = await this.directorAccess.resolveSectionInSchool(
      user.schoolId,
      sectionId,
    );

    const studentIds = dto.details.map((item: any) => item.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw new Error('Duplicate students in attendance details');
    }

    const registrations = await this.prisma.registration.findMany({
      where: {
        sectionId,
        schoolId: user.schoolId,
        studentId: { in: studentIds },
        status: true,
      },
      select: { studentId: true },
    });
    const allowedStudents = new Set(registrations.map((r) => r.studentId));

    for (const studentId of studentIds) {
      if (!allowedStudents.has(studentId)) {
        throw new Error(
          `Student ${studentId} is not registered in this section`,
        );
      }
    }

    const existing = await this.prisma.attendance.findFirst({
      where: {
        sectionId,
        date: day,
        deletedAt: null,
      },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.attendanceDetail.deleteMany({
          where: { attendanceId: existing.id },
        });
        await tx.attendance.update({
          where: { id: existing.id },
          data: {
            status: true,
            personId: user.id,
          },
        });
        await tx.attendanceDetail.createMany({
          data: dto.details.map((detail: any) => ({
            attendanceId: existing.id,
            studentId: detail.studentId,
            status: detail.status as 'present' | 'absent' | 'late' | 'excused',
            attendanceReasonId:
              detail.status === 'absent'
                ? detail.attendanceReasonId ?? null
                : null,
            description:
              detail.status === 'absent'
                ? detail.description?.trim() || null
                : null,
          })),
        });
        return;
      }

      await tx.attendance.create({
        data: {
          date: day,
          sectionId,
          personId: user.id,
          details: {
            create: dto.details.map((detail: any) => ({
              studentId: detail.studentId,
              status: detail.status as 'present' | 'absent' | 'late' | 'excused',
              attendanceReasonId:
                detail.status === 'absent'
                  ? detail.attendanceReasonId ?? null
                  : null,
              description:
                detail.status === 'absent'
                  ? detail.description?.trim() || null
                  : null,
            })),
          },
        },
      });
    });

    return this.getSheet(user, { sectionId, date: dto.date });
  }
}