import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import { DirectorAccessService } from './director-access.service';
import {
  DirectorGradeDetailDto,
  DirectorGradeEntryQueryDto,
  DirectorGradeOptionsResponseDto,
  DirectorGradeSheetDto,
  DirectorGradeSheetsResponseDto,
  DirectorGradesQueryDto,
  SaveDirectorGradeSheetDto,
} from './dto/director-grades.dto';
@Injectable()
export class DirectorGradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: DirectorAccessService,
  ) {}
  private ensure(u: AuthenticatedDirector) {
    this.access.ensureDirectorRole(u.role);
  }
  async listOptions(
    u: AuthenticatedDirector,
  ): Promise<DirectorGradeOptionsResponseDto> {
    this.ensure(u);
    const yearId = await this.access.currentYearId(u.schoolId);
    const [years, sections, types] = await Promise.all([
      this.prisma.year.findMany({
        where: { schoolId: u.schoolId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.section.findMany({
        where: {
          schoolId: u.schoolId,
          status: 1,
          ...(yearId ? { yearId } : {}),
        },
        include: { class: true, sectionTitle: true },
      }),
      this.prisma.gradeType.findMany({
        where: {
          status: true,
          OR: [{ schoolId: u.schoolId }, { schoolId: null }],
        },
        orderBy: [{ isMain: 'desc' }, { position: 'asc' }, { title: 'asc' }],
      }),
    ]);
    const courses = await this.prisma.classCourse.findMany({
      where: {
        classId: { in: sections.map((s) => s.classId) },
        status: true,
        ...(yearId ? { yearId } : {}),
      },
      include: { course: true },
    });
    const classes = new Map<number, any>();
    for (const section of sections) {
      const classOption = classes.get(section.classId) ?? {
        id: section.classId,
        name: section.class.className,
        sections: [],
      };
      classOption.sections.push({
        id: section.id,
        title: section.sectionTitle.title,
        yearId: section.yearId,
        courses: courses
          .filter(
            (course) =>
              course.classId === section.classId &&
              course.yearId === section.yearId,
          )
          .map((course) => ({
            id: course.courseId,
            title: course.course.title,
            coefficient: Number(course.coefficient),
            assignmentId: course.id,
          })),
      });
      classes.set(section.classId, classOption);
    }
    return {
      classes: [...classes.values()],
      gradeTypes: types.map((type) => ({
        id: type.id,
        title: type.title,
        isMain: type.isMain,
      })),
      years: years.map((year) => ({
        id: year.id,
        title: year.title,
        isCurrent: year.isCurrent,
      })),
    };
  }
  async listSheets(
    u: AuthenticatedDirector,
    q: DirectorGradesQueryDto,
  ): Promise<DirectorGradeSheetsResponseDto> {
    this.ensure(u);
    const { page, limit } = resolvePagination(q);
    const where: Prisma.GradeWhereInput = {
      schoolId: u.schoolId,
      ...(q.sectionId ? { sectionId: q.sectionId } : {}),
      ...(q.courseId ? { courseId: q.courseId } : {}),
      ...(q.gradeTypeId ? { gradeTypeId: q.gradeTypeId } : {}),
      ...(q.classId ? { section: { classId: q.classId } } : {}),
      ...(q.yearId ? { section: { yearId: q.yearId } } : {}),
      ...(q.published === undefined
        ? {}
        : { publishDate: q.published ? { not: null } : null }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.grade.count({ where }),
      this.prisma.grade.findMany({
        where,
        include: {
          gradeType: true,
          course: true,
          section: {
            include: {
              class: { include: { classCourses: true } },
              sectionTitle: true,
            },
          },
          details: { select: { grade: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      items: rows.map((r) => this.sheetDto(r)),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }
  async getEntry(
    u: AuthenticatedDirector,
    q: DirectorGradeEntryQueryDto | { gradeId: number },
  ): Promise<DirectorGradeDetailDto> {
    this.ensure(u);
    let row: any;
    if ('gradeId' in q)
      row = await this.prisma.grade.findFirst({
        where: { id: q.gradeId, schoolId: u.schoolId },
        include: this.detailInclude(),
      });
    else
      row = await this.prisma.grade.findFirst({
        where: {
          schoolId: u.schoolId,
          sectionId: q.sectionId,
          courseId: q.courseId,
          gradeTypeId: q.gradeTypeId,
        },
        include: this.detailInclude(),
      });
    if (!row && !('gradeId' in q))
      row = await this.context(u, q.sectionId, q.courseId, q.gradeTypeId);
    if (!row) throw new NotFoundException('Grade sheet not found');
    return this.detailDto(row);
  }
  async save(
    u: AuthenticatedDirector,
    b: SaveDirectorGradeSheetDto,
  ): Promise<DirectorGradeDetailDto> {
    this.ensure(u);
    const section = await this.prisma.section.findFirst({
      where: { id: b.sectionId, schoolId: u.schoolId, status: 1 },
    });
    if (!section) throw new BadRequestException('Section not found');
    const assignment = await this.prisma.classCourse.findFirst({
      where: {
        classId: section.classId,
        yearId: section.yearId,
        courseId: b.courseId,
        status: true,
      },
    });
    if (!assignment)
      throw new BadRequestException(
        'Course is not assigned to this section year',
      );
    const type = await this.prisma.gradeType.findFirst({
      where: {
        id: b.gradeTypeId,
        status: true,
        OR: [{ schoolId: u.schoolId }, { schoolId: null }],
      },
    });
    if (!type) throw new BadRequestException('Grade type not found');
    const regs = await this.prisma.registration.findMany({
      where: { sectionId: section.id, schoolId: u.schoolId, status: true },
      select: { id: true },
    });
    const allowed = new Set(regs.map((r) => r.id));
    for (const e of b.entries) {
      if (!allowed.has(e.registrationId))
        throw new BadRequestException('Registration is not in this section');
      if (e.score != null && e.score > b.maxGrade)
        throw new BadRequestException(
          `Score cannot be greater than max grade (${b.maxGrade})`,
        );
    }
    const id = await this.prisma.$transaction(async (tx) => {
      const old = await tx.grade.findFirst({
        where: {
          schoolId: u.schoolId,
          sectionId: b.sectionId,
          courseId: b.courseId,
          gradeTypeId: b.gradeTypeId,
        },
        select: { id: true },
      });
      const row = old
        ? await tx.grade.update({
            where: { id: old.id },
            data: {
              maxGrade: b.maxGrade,
              publishDate: b.publishDate
                ? new Date(`${b.publishDate}T00:00:00.000Z`)
                : null,
            },
          })
        : await tx.grade.create({
            data: {
              schoolId: u.schoolId,
              sectionId: b.sectionId,
              courseId: b.courseId,
              gradeTypeId: b.gradeTypeId,
              maxGrade: b.maxGrade,
              publishDate: b.publishDate
                ? new Date(`${b.publishDate}T00:00:00.000Z`)
                : null,
              personId: u.personId,
            },
          });
      for (const e of b.entries) {
        if (e.score == null && !e.comment?.trim())
          await tx.gradeDetail.deleteMany({
            where: { gradeId: row.id, registrationId: e.registrationId },
          });
        else
          await tx.gradeDetail.upsert({
            where: {
              gradeId_registrationId: {
                gradeId: row.id,
                registrationId: e.registrationId,
              },
            },
            create: {
              gradeId: row.id,
              registrationId: e.registrationId,
              grade: e.score ?? null,
              comment: e.comment?.trim() || null,
            },
            update: {
              grade: e.score ?? null,
              comment: e.comment?.trim() || null,
            },
          });
      }
      return row.id;
    });
    return this.getEntry(u, { gradeId: id });
  }
  async setPublication(
    u: AuthenticatedDirector,
    id: number,
    published: boolean,
  ) {
    this.ensure(u);
    const row = await this.prisma.grade.findFirst({
      where: { id, schoolId: u.schoolId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Grade sheet not found');
    await this.prisma.grade.update({
      where: { id },
      data: { publishDate: published ? new Date() : null },
    });
    return this.getEntry(u, { gradeId: id });
  }
  async delete(u: AuthenticatedDirector, id: number) {
    this.ensure(u);
    const row = await this.prisma.grade.findFirst({
      where: { id, schoolId: u.schoolId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Grade sheet not found');
    await this.prisma.grade.delete({ where: { id } });
    return { deleted: true, id };
  }
  private detailInclude() {
    return {
      gradeType: true,
      course: true,
      section: {
        include: {
          class: true,
          sectionTitle: true,
          registrations: {
            where: { status: true },
            include: { student: { include: { person: true } }, person: true },
            orderBy: { id: 'asc' },
          },
        },
      },
      details: true,
    } as const;
  }
  private async context(
    u: AuthenticatedDirector,
    sectionId: number,
    courseId: number,
    gradeTypeId: number,
  ) {
    const s = await this.prisma.section.findFirst({
      where: { id: sectionId, schoolId: u.schoolId, status: 1 },
      include: {
        class: true,
        sectionTitle: true,
        registrations: {
          where: { status: true },
          include: { student: { include: { person: true } }, person: true },
        },
      },
    });
    const c = await this.prisma.course.findFirst({
      where: { id: courseId, schoolId: u.schoolId },
    });
    const t = await this.prisma.gradeType.findFirst({
      where: {
        id: gradeTypeId,
        OR: [{ schoolId: u.schoolId }, { schoolId: null }],
      },
    });
    const assignment = s
      ? await this.prisma.classCourse.findFirst({
          where: {
            classId: s.classId,
            courseId,
            yearId: s.yearId,
            status: true,
          },
          select: { coefficient: true },
        })
      : null;
    if (!s || !c || !t) throw new BadRequestException('Invalid grade context');
    const maxGrade =
      assignment && Number(assignment.coefficient) > 0
        ? Number(assignment.coefficient)
        : 100;
    return {
      id: 0,
      sectionId,
      courseId,
      gradeTypeId,
      maxGrade,
      publishDate: null,
      gradeType: t,
      course: c,
      section: s,
      details: [],
    };
  }
  private sheetDto(r: any): DirectorGradeSheetDto {
    const details: any[] = r.details ?? [];
    const assignment = r.section.class.classCourses?.find(
      (x: any) => x.courseId === r.courseId && x.yearId === r.section.yearId,
    );
    return {
      id: r.id,
      classId: r.section.classId,
      className: r.section.class.className,
      sectionId: r.sectionId,
      sectionTitle: r.section.sectionTitle.title,
      classLabel: `${r.section.class.className} - ${r.section.sectionTitle.title}`,
      courseId: r.courseId,
      courseTitle: r.course.title,
      gradeTypeId: r.gradeTypeId,
      gradeTypeTitle: r.gradeType.title,
      maxGrade: Number(r.maxGrade),
      coefficient: assignment ? Number(assignment.coefficient) : 1,
      publishDate: r.publishDate?.toISOString().slice(0, 10) ?? null,
      published: r.publishDate != null,
      entriesCount: details.length,
      scoredCount: details.filter((d) => d.grade != null).length,
    };
  }
  private detailDto(r: any): DirectorGradeDetailDto {
    const base = this.sheetDto(r);
    const map = new Map<number, any>(
      r.details.map((d: any) => [d.registrationId, d]),
    );
    return {
      ...base,
      gradeSheetId: r.id || null,
      isMain: !!r.gradeType.isMain,
      canPublish: true,
      students: r.section.registrations.map((x: any, i: number) => {
        const d: any = map.get(x.id);
        const p = x.student?.person ?? x.person;
        return {
          registrationId: x.id,
          studentId: x.studentId,
          fullName: [p?.firstName, p?.middleName, p?.lastName]
            .filter(Boolean)
            .join(' '),
          seatNumber: i + 1,
          score: d?.grade == null ? null : Number(d.grade),
          comment: d?.comment ?? null,
        };
      }),
    };
  }
}
