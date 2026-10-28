import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class DirectorAccessService {
  constructor(private readonly prisma: PrismaService) {}

  ensureDirectorRole(role: string): void {
    if (role !== 'director') {
      throw new ForbiddenException('Director access required');
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

  async assertSectionInSchool(
    schoolId: number,
    sectionId: number,
  ): Promise<boolean> {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, schoolId },
    });

    return !!section;
  }

  async sectionSchoolId(sectionId: number): Promise<number | null> {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId },
      select: { schoolId: true },
    });

    return section?.schoolId ?? null;
  }

  async schoolHasDirectorAssignment(
    schoolId: number,
    directorId: number,
  ): Promise<boolean> {
    const assignment = await this.prisma.directorSchool.findFirst({
      where: {
        directorId,
        schoolId,
        isActive: true,
        school: { isActive: true },
      },
    });

    return !!assignment;
  }

  async resolveSectionInSchool(schoolId: number, sectionId: number) {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, schoolId },
      select: {
        id: true,
        schoolId: true,
        class: {
          select: {
            id: true,
            className: true,
            stage: { select: { id: true, title: true } },
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

  async listSectionsInSchool(
    schoolId: number,
    yearId?: number | null,
  ): Promise<{ total: number; sections: any[] }> {
    const where = {
      schoolId,
      ...(yearId ? { yearId } : {}),
    };

    const [total, sections] = await this.prisma.$transaction([
      this.prisma.section.count({ where }),
      this.prisma.section.findMany({
        where,
        select: {
          id: true,
          yearId: true,
          class: {
            select: {
              id: true,
              className: true,
              stage: { select: { title: true } },
            },
          },
          sectionTitle: { select: { title: true } },
          year: { select: { id: true, title: true } },
          _count: {
            select: {
              registrations: { where: { status: true } },
            },
          },
        },
        orderBy: [{ class: { className: 'asc' } }, { id: 'asc' }],
      }),
    ]);

    return { total, sections };
  }

  async listStudentsInSection(
    schoolId: number,
    sectionId: number,
  ): Promise<{ studentCount: number; students: any[] }> {
    const registrations = await this.prisma.registration.findMany({
      where: { sectionId, schoolId, status: true },
      select: {
        student: {
          select: {
            id: true,
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
      orderBy: [
        { student: { person: { firstName: 'asc' } } },
        { student: { person: { lastName: 'asc' } } },
        { id: 'asc' },
      ],
    });

    return {
      studentCount: registrations.length,
      students: registrations.map((registration, index) => ({
        id: registration.student.id,
        fullName: registration.student.person
          ? `${registration.student.person.firstName} ${
              registration.student.person.middleName
                ? registration.student.person.middleName[0] + '. '
                : ''
            }${registration.student.person.lastName}`
          : '',
        seatNumber: index + 1,
      })),
    };
  }

  async canDirectorAccessSection(
    directorId: number,
    schoolId: number,
    sectionId: number,
  ): Promise<boolean> {
    // Director has access to all sections in their assigned school
    const sectionExists = await this.assertSectionInSchool(schoolId, sectionId);
    const schoolAssignment = await this.schoolHasDirectorAssignment(
      schoolId,
      directorId,
    );

    return sectionExists && schoolAssignment;
  }
}
