import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class DirectorGradesService {
  constructor(private readonly prisma: PrismaService) {}

  async listOptions(
    user: { role: string; schoolId: number },
  ): Promise<Object> {
    this.checkDirectorRole(user.role);

    const gradeTypes = await this.prisma.gradeType.findMany({
      where: { schoolId: user.schoolId },
    });

    const coefficients = await this.prisma.accountCodeCounter.findMany({
      where: { schoolId: user.schoolId },
    });

    return {
      gradeTypes,
      coefficients,
    };
  }

  async listSheets(
    user: { role: string; schoolId: number },
    query: any,
  ): Promise<Object> {
    this.checkDirectorRole(user.role);

    const { page, limit } = this.resolvePagination(query);
    const skip = (page - 1) * limit;

    const [totalResult, rowsResult] = await this.prisma.$transaction([
      this.prisma.grade.count({ where: { schoolId: user.schoolId } }),
      this.prisma.grade.findMany({
        where: { schoolId: user.schoolId },
        select: {
          id: true,
          person: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
          gradeType: true,
          section: {
            select: {
              class: { select: { className: true } },
              sectionTitle: { select: { title: true } },
              year: { select: { title: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const total = Number(totalResult);
    const rows = rowsResult as any[];

    return {
      items: rows.map((g: any) => ({
        id: g.id,
        studentName: g.person
          ? `${g.person.firstName || ''} ${g.person.middleName || ''} ${g.person.lastName || ''}`.trim()
          : '',
        gradeType: g.gradeType?.title || '',
        section: g.section
          ? `${g.section.class?.className || ''} - ${g.section.sectionTitle?.title || ''} (${g.section.year?.title || ''})`
          : '',
      })),
      pagination: {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        total,
      },
    };
  }

  async getEntry(
    user: { role: string; schoolId: number },
    query: any,
  ): Promise<Object> {
    this.checkDirectorRole(user.role);

    const { sectionId, courseId, gradeTypeId } = query;

    const students = await this.prisma.registration.findMany({
      where: { sectionId, schoolId: user.schoolId, status: true },
    });

    const gradeType = await this.prisma.gradeType.findFirst({
      where: { id: gradeTypeId, schoolId: user.schoolId },
    });

    return {
      sectionId,
      courseId,
      gradeType: gradeType?.title,
      students: students.map((s: any) => ({
        id: s.student.id,
        fullName: s.student.person
          ? `${s.student.person.firstName} ${s.student.person.middleName || ''} ${s.student.person.lastName || ''}`.trim()
          : '',
      })),
    };
  }

  private checkDirectorRole(role: string): void {
    if (role !== 'director') {
      throw new ForbiddenException('Director access required');
    }
  }

  private resolvePagination(query: any): { page: number; limit: number } {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return { page, limit };
  }
}