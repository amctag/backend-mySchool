import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SchoolAttendancePolicyService } from '../school/school-attendance-policy.service';
import { TeacherAccessService } from './teacher-access.service';
import {
  SaveTeacherAttendanceDto,
  TeacherAttendanceOptionsDto,
  TeacherAttendanceSheetDto,
  TeacherAttendanceSheetQueryDto,
  TeacherAttendancesQueryDto,
  TeacherAttendancesResponseDto,
} from './dto/teacher-attendance.dto';
import {
  formatClassLabel,
  formatDateOnly,
  formatFullName,
  parseDateOnly,
} from './teacher.util';

type EligibleScope = {
  sectionId: number;
  classId: number;
  className: string;
  sectionTitle: string;
  courseId: number | null;
  courseTitle: string | null;
};

@Injectable()
export class TeacherAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAccess: TeacherAccessService,
    private readonly attendancePolicy: SchoolAttendancePolicyService,
  ) {}

  async listOptions(
    user: AuthenticatedTeacher,
    date?: string,
  ): Promise<TeacherAttendanceOptionsDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const day = date ? parseDateOnly(date) : parseDateOnly(formatDateOnly(new Date()));
    const [scopes, reasons, policy] = await Promise.all([
      this.eligibleScopes(user, day),
      this.prisma.attendanceReason.findMany({
        where: { deletedAt: null, status: true },
        select: { id: true, title: true },
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
      }),
      this.attendancePolicy.getPolicy(user.schoolId),
    ]);

    const classes = new Map<
      number,
      {
        id: number;
        name: string;
        sections: Map<
          number,
          {
            id: number;
            title: string;
            courses: Map<number, { id: number; title: string }>;
          }
        >;
      }
    >();

    for (const scope of scopes) {
      const mutableClass =
        classes.get(scope.classId) ??
        {
          id: scope.classId,
          name: scope.className,
          sections: new Map<
            number,
            {
              id: number;
              title: string;
              courses: Map<number, { id: number; title: string }>;
            }
          >(),
        };
      classes.set(scope.classId, mutableClass);
      const section =
        mutableClass.sections.get(scope.sectionId) ??
        {
          id: scope.sectionId,
          title: scope.sectionTitle,
          courses: new Map<number, { id: number; title: string }>(),
        };
      mutableClass.sections.set(scope.sectionId, section);
      if (scope.courseId && scope.courseTitle) {
        section.courses.set(scope.courseId, {
          id: scope.courseId,
          title: scope.courseTitle,
        });
      }
    }

    return {
      attendancePerCourse: policy.attendancePerCourse,
      classes: [...classes.values()].map((item) => ({
        id: item.id,
        name: item.name,
        sections: [...item.sections.values()].map((section) => ({
          id: section.id,
          title: section.title,
          courses: [...section.courses.values()],
        })),
      })),
      reasons,
    };
  }

  async listAttendances(
    user: AuthenticatedTeacher,
    query: TeacherAttendancesQueryDto,
  ): Promise<TeacherAttendancesResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const day = query.date
      ? parseDateOnly(query.date)
      : parseDateOnly(formatDateOnly(new Date()));
    const scopes = await this.eligibleScopes(user, day);
    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 20,
    });
    if (scopes.length === 0) {
      return {
        items: [],
        pagination: buildPaginationMeta(page, limit, 0),
      };
    }

    const policy = await this.attendancePolicy.getPolicy(user.schoolId);
    const orFilters: Prisma.AttendanceWhereInput[] = policy.attendancePerCourse
      ? scopes.map((scope) => ({
          sectionId: scope.sectionId,
          courseId: scope.courseId,
        }))
      : [...new Set(scopes.map((scope) => scope.sectionId))].map(
          (sectionId) => ({ sectionId, courseId: null }),
        );
    const where: Prisma.AttendanceWhereInput = {
      deletedAt: null,
      date: day,
      OR: orFilters,
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
          details: {
            where: { deletedAt: null },
            select: { status: true },
          },
        },
        orderBy: [{ id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        date: formatDateOnly(row.date),
        sectionId: row.sectionId ?? 0,
        classLabel: row.section
          ? formatClassLabel(
              row.section.class.className,
              row.section.sectionTitle.title,
            )
          : '',
        courseId: row.courseId,
        courseTitle: row.course?.title ?? null,
        studentCount: row.details.length,
        absentCount: row.details.filter((item) => item.status === 'absent')
          .length,
      })),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getSheet(
    user: AuthenticatedTeacher,
    query: TeacherAttendanceSheetQueryDto,
  ): Promise<TeacherAttendanceSheetDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const day = parseDateOnly(query.date);
    const policy = await this.attendancePolicy.getPolicy(user.schoolId);
    if (policy.attendancePerCourse && !query.courseId) {
      throw new BadRequestException('courseId is required for this school');
    }
    const courseId = policy.attendancePerCourse ? query.courseId : undefined;
    const allowed = await this.teacherAccess.canTakeAttendance({
      user,
      sectionId: query.sectionId,
      date: day,
      courseId,
    });
    if (!allowed.allowed) {
      throw new ForbiddenException(
        'You cannot take attendance for this class',
      );
    }

    const section = await this.teacherAccess.findSectionInSchool(
      user.schoolId,
      query.sectionId,
    );
    const resolvedCourseId = policy.attendancePerCourse
      ? (courseId ?? null)
      : null;

    const [registrations, existing, course] = await Promise.all([
      this.prisma.registration.findMany({
        where: {
          schoolId: user.schoolId,
          sectionId: query.sectionId,
          status: true,
        },
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
        orderBy: [{ id: 'asc' }],
      }),
      this.prisma.attendance.findFirst({
        where: {
          sectionId: query.sectionId,
          date: day,
          deletedAt: null,
          courseId: resolvedCourseId,
        },
        include: {
          details: {
            where: { deletedAt: null },
            include: {
              attendanceReason: { select: { id: true, title: true } },
            },
          },
        },
      }),
      resolvedCourseId
        ? this.prisma.course.findFirst({
            where: { id: resolvedCourseId, schoolId: user.schoolId },
            select: { id: true, title: true },
          })
        : Promise.resolve(null),
    ]);

    const detailByStudent = new Map(
      (existing?.details ?? []).map((detail) => [detail.studentId, detail]),
    );

    return {
      attendanceId: existing?.id ?? null,
      date: formatDateOnly(day),
      sectionId: query.sectionId,
      classLabel: formatClassLabel(
        section.class.className,
        section.sectionTitle.title,
      ),
      courseId: resolvedCourseId,
      courseTitle: course?.title ?? null,
      attendancePerCourse: policy.attendancePerCourse,
      students: registrations.map((registration) => {
        const detail = detailByStudent.get(registration.studentId);
        return {
          studentId: registration.studentId,
          registrationId: registration.id,
          studentName: formatFullName(registration.student.person),
          status: (detail?.status ?? 'present') as
            | 'present'
            | 'absent'
            | 'late'
            | 'excused',
          attendanceReasonId: detail?.attendanceReasonId ?? null,
          attendanceReasonTitle: detail?.attendanceReason?.title ?? null,
          description: detail?.description ?? null,
        };
      }),
    };
  }

  async saveAttendance(
    user: AuthenticatedTeacher,
    dto: SaveTeacherAttendanceDto,
  ): Promise<TeacherAttendanceSheetDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const day = parseDateOnly(dto.date);
    const policy = await this.attendancePolicy.getPolicy(user.schoolId);
    const courseId = policy.attendancePerCourse ? dto.courseId : null;
    const allowed = await this.teacherAccess.canTakeAttendance({
      user,
      sectionId: dto.sectionId,
      date: day,
      courseId,
    });
    if (!allowed.allowed) {
      throw new ForbiddenException(
        'You cannot take attendance for this class',
      );
    }
    if (policy.attendancePerCourse && !courseId) {
      throw new BadRequestException('courseId is required for this school');
    }

    const studentIds = dto.details.map((item) => item.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw new BadRequestException('Duplicate students in attendance details');
    }

    const registrations = await this.prisma.registration.findMany({
      where: {
        schoolId: user.schoolId,
        sectionId: dto.sectionId,
        studentId: { in: studentIds },
        status: true,
      },
      select: { studentId: true },
    });
    const allowedStudents = new Set(
      registrations.map((item) => item.studentId),
    );
    for (const studentId of studentIds) {
      if (!allowedStudents.has(studentId)) {
        throw new BadRequestException(
          `Student ${studentId} is not registered in this section`,
        );
      }
    }

    for (const detail of dto.details) {
      if (detail.status === 'absent' && !detail.attendanceReasonId) {
        throw new BadRequestException(
          'Attendance reason is required when a student is absent',
        );
      }
    }

    const absentReasonIds = [
      ...new Set(
        dto.details
          .filter((detail) => detail.status === 'absent')
          .map((detail) => detail.attendanceReasonId)
          .filter((id): id is number => typeof id === 'number' && id > 0),
      ),
    ];
    if (absentReasonIds.length > 0) {
      const reasons = await this.prisma.attendanceReason.findMany({
        where: {
          id: { in: absentReasonIds },
          deletedAt: null,
          status: true,
        },
        select: { id: true },
      });
      if (reasons.length !== absentReasonIds.length) {
        throw new BadRequestException(
          'One or more attendance reasons are invalid or inactive',
        );
      }
    }

    const existing = await this.prisma.attendance.findFirst({
      where: {
        sectionId: dto.sectionId,
        date: day,
        deletedAt: null,
        courseId: courseId ?? null,
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
            courseId: courseId ?? null,
          },
        });
        await tx.attendanceDetail.createMany({
          data: dto.details.map((detail) => ({
            attendanceId: existing.id,
            studentId: detail.studentId,
            status: detail.status as AttendanceStatus,
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
          sectionId: dto.sectionId,
          courseId: courseId ?? null,
          personId: user.id,
          status: true,
          details: {
            create: dto.details.map((detail) => ({
              studentId: detail.studentId,
              status: detail.status as AttendanceStatus,
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

    return this.getSheet(user, {
      sectionId: dto.sectionId,
      date: dto.date,
      courseId: courseId ?? undefined,
    });
  }

  private async eligibleScopes(
    user: AuthenticatedTeacher,
    date: Date,
  ): Promise<EligibleScope[]> {
    const [policy, teaches] = await Promise.all([
      this.attendancePolicy.getPolicy(user.schoolId),
      this.prisma.teach.findMany({
        where: {
          teacherId: user.teacherId,
          section: { schoolId: user.schoolId },
        },
        select: {
          sectionId: true,
          courseId: true,
          course: { select: { title: true } },
          section: {
            select: {
              classId: true,
              class: { select: { className: true } },
              sectionTitle: { select: { title: true } },
            },
          },
        },
      }),
    ]);

    if (policy.attendancePerCourse) {
      return teaches.map((row) => ({
        sectionId: row.sectionId,
        classId: row.section.classId,
        className: row.section.class.className,
        sectionTitle: row.section.sectionTitle.title,
        courseId: row.courseId,
        courseTitle: row.course.title,
      }));
    }

    const sectionIds = [...new Set(teaches.map((row) => row.sectionId))];
    const firstSessions = await this.attendancePolicy.firstSessionsBySection(
      user.schoolId,
      sectionIds,
      date,
    );
    const seen = new Set<number>();
    const scopes: EligibleScope[] = [];
    for (const row of teaches) {
      if (seen.has(row.sectionId)) {
        continue;
      }
      const first = firstSessions.get(row.sectionId);
      const isFirstPerson = first?.personId === user.id;
      const isFirstCourse = first?.courseId === row.courseId;
      if (!isFirstPerson && !isFirstCourse) {
        continue;
      }
      seen.add(row.sectionId);
      scopes.push({
        sectionId: row.sectionId,
        classId: row.section.classId,
        className: row.section.class.className,
        sectionTitle: row.section.sectionTitle.title,
        courseId: null,
        courseTitle: null,
      });
    }
    return scopes;
  }
}
