import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SchoolAttendancePolicyService } from '../school/school-attendance-policy.service';

export const assignmentInclude = {
  course: { select: { id: true, title: true } },
  year: { select: { id: true, title: true, isCurrent: true } },
  section: {
    select: {
      id: true,
      schoolId: true,
      class: {
        select: {
          className: true,
          stage: { select: { title: true } },
        },
      },
      sectionTitle: { select: { title: true } },
      year: { select: { id: true, title: true } },
    },
  },
} as const;

export type TeacherAssignmentRecord = Prisma.TeachGetPayload<{
  include: typeof assignmentInclude;
}>;

@Injectable()
export class TeacherAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendancePolicy: SchoolAttendancePolicyService,
  ) {}

  ensureTeacherRole(user: AuthenticatedTeacher): void {
    if (user.role !== 'teacher' || !user.teacherId || !user.schoolId) {
      throw new ForbiddenException('You cannot access this resource');
    }
  }

  async currentYearId(schoolId: number): Promise<number | null> {
    const current = await this.prisma.year.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
      orderBy: { id: 'desc' },
    });

    if (current) {
      return current.id;
    }

    const latest = await this.prisma.year.findFirst({
      where: { schoolId },
      select: { id: true },
      orderBy: { id: 'desc' },
    });

    return latest?.id ?? null;
  }

  async getAssignment(
    user: AuthenticatedTeacher,
    assignmentId: number,
  ): Promise<TeacherAssignmentRecord> {
    this.ensureTeacherRole(user);

    const assignment = await this.prisma.teach.findFirst({
      where: {
        id: assignmentId,
        teacherId: user.teacherId,
        section: { schoolId: user.schoolId },
      },
      include: assignmentInclude,
    });

    if (!assignment) {
      throw new NotFoundException('Teaching assignment not found');
    }

    return assignment;
  }

  async assertAssignedSection(
    user: AuthenticatedTeacher,
    sectionId: number,
    yearId?: number | null,
  ): Promise<void> {
    this.ensureTeacherRole(user);

    const teach = await this.prisma.teach.findFirst({
      where: {
        teacherId: user.teacherId,
        sectionId,
        section: { schoolId: user.schoolId },
        ...(yearId ? { yearId } : {}),
      },
      select: { id: true },
    });

    if (!teach) {
      throw new ForbiddenException('You are not assigned to this class');
    }
  }

  async supervisedSectionIds(
    user: AuthenticatedTeacher,
    yearId?: number | null,
  ): Promise<number[]> {
    this.ensureTeacherRole(user);
    const rows = await this.prisma.teacherSupervisor.findMany({
      where: {
        teacherId: user.teacherId,
        class: { stage: { schoolId: user.schoolId } },
        ...(yearId ? { yearId } : {}),
      },
      select: { classId: true, yearId: true },
    });
    if (rows.length === 0) {
      return [];
    }
    const sections = await this.prisma.section.findMany({
      where: {
        schoolId: user.schoolId,
        OR: rows.map((row) => ({
          classId: row.classId,
          yearId: row.yearId,
        })),
      },
      select: { id: true },
    });
    return [...new Set(sections.map((row) => row.id))];
  }

  async taughtSectionIds(
    user: AuthenticatedTeacher,
    yearId?: number | null,
  ): Promise<number[]> {
    this.ensureTeacherRole(user);
    const rows = await this.prisma.teach.findMany({
      where: {
        teacherId: user.teacherId,
        section: { schoolId: user.schoolId },
        ...(yearId ? { yearId } : {}),
      },
      select: { sectionId: true },
    });
    return [...new Set(rows.map((row) => row.sectionId))];
  }

  async taughtOrSupervisedSectionIds(
    user: AuthenticatedTeacher,
    yearId?: number | null,
  ): Promise<number[]> {
    const [taught, supervised] = await Promise.all([
      this.taughtSectionIds(user, yearId),
      this.supervisedSectionIds(user, yearId),
    ]);
    return [...new Set([...taught, ...supervised])];
  }

  async isSupervisorOfSection(
    user: AuthenticatedTeacher,
    sectionId: number,
    yearId?: number | null,
  ): Promise<boolean> {
    this.ensureTeacherRole(user);
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, schoolId: user.schoolId },
      select: { classId: true, yearId: true },
    });
    if (!section) {
      return false;
    }
    const row = await this.prisma.teacherSupervisor.findFirst({
      where: {
        teacherId: user.teacherId,
        classId: section.classId,
        yearId: yearId ?? section.yearId,
        class: { stage: { schoolId: user.schoolId } },
      },
      select: { id: true },
    });
    return Boolean(row);
  }

  async supervisorPersonIdsForSection(
    schoolId: number,
    sectionId: number,
  ): Promise<number[]> {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, schoolId },
      select: { classId: true, yearId: true },
    });
    if (!section) {
      return [];
    }

    let rows = await this.prisma.teacherSupervisor.findMany({
      where: {
        classId: section.classId,
        yearId: section.yearId,
      },
      select: {
        teacher: { select: { personId: true } },
      },
    });

    if (rows.length === 0) {
      rows = await this.prisma.teacherSupervisor.findMany({
        where: {
          classId: section.classId,
          class: { stage: { schoolId } },
        },
        select: {
          teacher: { select: { personId: true } },
        },
      });
    }

    return [
      ...new Set(rows.map((row) => row.teacher.personId).filter(Boolean)),
    ];
  }

  async assertAssignedOrSupervisedSection(
    user: AuthenticatedTeacher,
    sectionId: number,
    yearId?: number | null,
  ): Promise<void> {
    this.ensureTeacherRole(user);
    const teach = await this.prisma.teach.findFirst({
      where: {
        teacherId: user.teacherId,
        sectionId,
        section: { schoolId: user.schoolId },
        ...(yearId ? { yearId } : {}),
      },
      select: { id: true },
    });
    if (teach) {
      return;
    }
    const supervises = await this.isSupervisorOfSection(user, sectionId, yearId);
    if (!supervises) {
      throw new ForbiddenException('You are not assigned to this class');
    }
  }

  async findSectionInSchool(schoolId: number, sectionId: number) {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, schoolId },
      select: {
        id: true,
        schoolId: true,
        class: {
          select: {
            className: true,
            stage: { select: { title: true } },
          },
        },
        sectionTitle: { select: { title: true } },
        year: { select: { id: true, title: true } },
      },
    });

    if (!section) {
      throw new NotFoundException('Class not found');
    }

    return section;
  }

  canTakeAttendance(params: {
    user: AuthenticatedTeacher;
    sectionId: number;
    date: Date;
    courseId?: number | null;
  }): Promise<{ allowed: boolean; courseId: number | null }> {
    return this.resolveAttendanceAccess(params);
  }

  private async resolveAttendanceAccess(params: {
    user: AuthenticatedTeacher;
    sectionId: number;
    date: Date;
    courseId?: number | null;
  }): Promise<{ allowed: boolean; courseId: number | null }> {
    this.ensureTeacherRole(params.user);
    const result = await this.attendancePolicy.canTeacherTakeAttendance({
      schoolId: params.user.schoolId,
      teacherPersonId: params.user.id,
      teacherId: params.user.teacherId,
      sectionId: params.sectionId,
      date: params.date,
      courseId: params.courseId,
    });
    if (result.allowed) {
      return result;
    }

    const isSupervisor = await this.isSupervisorOfSection(
      params.user,
      params.sectionId,
    );
    if (!isSupervisor) {
      return result;
    }

    const policy = await this.attendancePolicy.getPolicy(params.user.schoolId);
    if (!policy.teachersCanTakeAttendance) {
      return { allowed: false, courseId: null };
    }
    if (policy.attendancePerCourse) {
      const courseId = params.courseId ?? null;
      if (!courseId) {
        return { allowed: false, courseId: null };
      }
      return { allowed: true, courseId };
    }

    return { allowed: true, courseId: null };
  }
}
