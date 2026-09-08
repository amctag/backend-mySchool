import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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
}
