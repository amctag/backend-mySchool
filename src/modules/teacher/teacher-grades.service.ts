import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TeacherAccessService } from './teacher-access.service';
import { TeacherMessageResponseDto } from './dto/teacher-auth.dto';
import {
  SaveTeacherGradeSheetDto,
  TeacherGradeClassOptionDto,
  TeacherGradeEntryContextDto,
  TeacherGradeEntryQueryDto,
  TeacherGradeOptionsResponseDto,
  TeacherGradeSheetItemDto,
  TeacherGradeSheetsResponseDto,
  TeacherGradesQueryDto,
} from './dto/teacher-grades.dto';
import {
  formatClassLabel,
  formatDateOnly,
  formatFullName,
  parseDateOnly,
} from './teacher.util';

const DEFAULT_MAX_GRADE = 100;

type AssignedTeach = {
  id: number;
  courseId: number;
  sectionId: number;
  course: { id: number; title: string };
  section: {
    id: number;
    classId: number;
    yearId: number;
    class: { id: number; className: string };
    sectionTitle: { title: string };
  };
};

@Injectable()
export class TeacherGradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAccess: TeacherAccessService,
  ) {}

  async listOptions(
    user: AuthenticatedTeacher,
  ): Promise<TeacherGradeOptionsResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const yearId = await this.teacherAccess.currentYearId(user.schoolId);
    const [teaches, gradeTypes] = await Promise.all([
      this.loadAssignedTeaches(user, yearId),
      this.prisma.gradeType.findMany({
        where: {
          status: true,
          OR: [{ schoolId: user.schoolId }, { schoolId: null }],
        },
        select: { id: true, title: true },
        orderBy: [{ position: 'asc' }, { title: 'asc' }],
      }),
    ]);

    const coefficientByKey = await this.loadCoefficients(yearId, teaches);

    return {
      classes: this.groupOptions(teaches, coefficientByKey, yearId),
      gradeTypes,
    };
  }

  async listSheets(
    user: AuthenticatedTeacher,
    query: TeacherGradesQueryDto,
  ): Promise<TeacherGradeSheetsResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 20,
    });
    const yearId = await this.teacherAccess.currentYearId(user.schoolId);
    const teaches = await this.loadAssignedTeaches(user, yearId);
    if (teaches.length === 0) {
      return {
        items: [],
        pagination: buildPaginationMeta(page, limit, 0),
      };
    }

    const pairs = this.uniquePairs(teaches);
    const where: Prisma.GradeWhereInput = {
      schoolId: user.schoolId,
      OR: pairs.map((pair) => ({
        sectionId: pair.sectionId,
        courseId: pair.courseId,
      })),
      ...(query.classId ? { section: { classId: query.classId } } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.gradeTypeId ? { gradeTypeId: query.gradeTypeId } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.grade.count({ where }),
      this.prisma.grade.findMany({
        where,
        include: {
          course: { select: { id: true, title: true } },
          gradeType: { select: { id: true, title: true } },
          section: {
            select: {
              id: true,
              classId: true,
              class: { select: { id: true, className: true } },
              sectionTitle: { select: { title: true } },
              yearId: true,
            },
          },
          _count: { select: { details: true } },
        },
        orderBy: [{ publishDate: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    const coefficientByKey = await this.loadCoefficients(
      yearId,
      rows.map((row) => ({
        section: {
          classId: row.section.classId,
          yearId: row.section.yearId,
        },
        courseId: row.courseId,
      })),
    );

    return {
      items: rows.map((row) =>
        this.toSheetItem(row, coefficientByKey, yearId),
      ),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getEntry(
    user: AuthenticatedTeacher,
    query: TeacherGradeEntryQueryDto,
  ): Promise<TeacherGradeEntryContextDto> {
    const assignment = await this.assertAssignedCourse(
      user,
      query.sectionId,
      query.courseId,
    );
    const gradeType = await this.assertGradeType(user.schoolId, query.gradeTypeId);

    const [registrations, existing, classCourse] = await Promise.all([
      this.prisma.registration.findMany({
        where: {
          sectionId: query.sectionId,
          schoolId: user.schoolId,
          status: true,
        },
        select: {
          id: true,
          student: {
            select: {
              id: true,
              person: {
                select: { firstName: true, middleName: true, lastName: true },
              },
            },
          },
        },
        orderBy: [
          { student: { person: { firstName: 'asc' } } },
          { student: { person: { lastName: 'asc' } } },
          { id: 'asc' },
        ],
      }),
      this.prisma.grade.findFirst({
        where: {
          schoolId: user.schoolId,
          sectionId: query.sectionId,
          courseId: query.courseId,
          gradeTypeId: query.gradeTypeId,
        },
        select: {
          id: true,
          maxGrade: true,
          publishDate: true,
          details: {
            select: { registrationId: true, grade: true, comment: true },
          },
        },
      }),
      this.prisma.classCourse.findFirst({
        where: {
          classId: assignment.section.classId,
          courseId: query.courseId,
          yearId: assignment.section.yearId,
          status: true,
        },
        select: { coefficient: true },
      }),
    ]);

    const detailByRegistration = new Map(
      (existing?.details ?? []).map((detail) => [detail.registrationId, detail]),
    );

    return {
      gradeSheetId: existing?.id ?? null,
      assignmentId: assignment.id,
      classId: assignment.section.class.id,
      className: assignment.section.class.className,
      sectionId: assignment.section.id,
      sectionTitle: assignment.section.sectionTitle.title,
      classLabel: formatClassLabel(
        assignment.section.class.className,
        assignment.section.sectionTitle.title,
      ),
      courseId: assignment.course.id,
      courseTitle: assignment.course.title,
      gradeTypeId: gradeType.id,
      gradeTypeTitle: gradeType.title,
      coefficient: classCourse ? Number(classCourse.coefficient) : 1,
      maxGrade: existing ? Number(existing.maxGrade) : DEFAULT_MAX_GRADE,
      publishDate: existing?.publishDate
        ? formatDateOnly(existing.publishDate)
        : formatDateOnly(new Date()),
      students: registrations.map((registration, index) => {
        const detail = detailByRegistration.get(registration.id);
        return {
          registrationId: registration.id,
          studentId: registration.student.id,
          fullName: formatFullName(registration.student.person),
          seatNumber: index + 1,
          score: detail?.grade == null ? null : Number(detail.grade),
          comment: detail?.comment ?? null,
        };
      }),
    };
  }

  async saveSheet(
    user: AuthenticatedTeacher,
    dto: SaveTeacherGradeSheetDto,
  ): Promise<TeacherGradeEntryContextDto> {
    await this.assertAssignedCourse(user, dto.sectionId, dto.courseId);
    await this.assertGradeType(user.schoolId, dto.gradeTypeId);

    const registrations = await this.prisma.registration.findMany({
      where: {
        sectionId: dto.sectionId,
        schoolId: user.schoolId,
        status: true,
      },
      select: { id: true },
    });
    const registrationIds = new Set(registrations.map((row) => row.id));

    for (const entry of dto.entries) {
      if (!registrationIds.has(entry.registrationId)) {
        throw new BadRequestException(
          'One or more students are not registered in this class',
        );
      }
      if (entry.score != null && entry.score > dto.maxGrade) {
        throw new BadRequestException(
          `Score cannot be greater than max grade (${dto.maxGrade})`,
        );
      }
    }

    const publishDate = dto.publishDate ? parseDateOnly(dto.publishDate) : null;

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.grade.findFirst({
        where: {
          schoolId: user.schoolId,
          sectionId: dto.sectionId,
          courseId: dto.courseId,
          gradeTypeId: dto.gradeTypeId,
        },
        select: { id: true },
      });

      let sheetId: number;
      if (existing) {
        await tx.grade.update({
          where: { id: existing.id },
          data: {
            maxGrade: dto.maxGrade,
            publishDate,
            personId: user.id,
          },
        });
        sheetId = existing.id;
      } else {
        const created = await tx.grade.create({
          data: {
            schoolId: user.schoolId,
            sectionId: dto.sectionId,
            courseId: dto.courseId,
            gradeTypeId: dto.gradeTypeId,
            maxGrade: dto.maxGrade,
            publishDate,
            personId: user.id,
          },
          select: { id: true },
        });
        sheetId = created.id;
      }

      for (const entry of dto.entries) {
        const hasValue =
          entry.score != null ||
          (entry.comment != null && entry.comment.trim().length > 0);

        if (!hasValue) {
          await tx.gradeDetail.deleteMany({
            where: {
              gradeId: sheetId,
              registrationId: entry.registrationId,
            },
          });
          continue;
        }

        await tx.gradeDetail.upsert({
          where: {
            gradeId_registrationId: {
              gradeId: sheetId,
              registrationId: entry.registrationId,
            },
          },
          create: {
            gradeId: sheetId,
            registrationId: entry.registrationId,
            grade: entry.score ?? null,
            comment: entry.comment?.trim() || null,
          },
          update: {
            grade: entry.score ?? null,
            comment: entry.comment?.trim() || null,
          },
        });
      }
    });

    return this.getEntry(user, {
      sectionId: dto.sectionId,
      courseId: dto.courseId,
      gradeTypeId: dto.gradeTypeId,
    });
  }

  async deleteSheet(
    user: AuthenticatedTeacher,
    gradeId: number,
  ): Promise<TeacherMessageResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const row = await this.prisma.grade.findFirst({
      where: { id: gradeId, schoolId: user.schoolId },
      select: { id: true, sectionId: true, courseId: true },
    });
    if (!row) {
      throw new NotFoundException('Grade sheet not found');
    }
    await this.assertAssignedCourse(user, row.sectionId, row.courseId);
    await this.prisma.grade.delete({ where: { id: row.id } });
    return { message: 'Grade sheet deleted successfully' };
  }

  private async loadAssignedTeaches(
    user: AuthenticatedTeacher,
    yearId: number | null,
  ): Promise<AssignedTeach[]> {
    return this.prisma.teach.findMany({
      where: {
        teacherId: user.teacherId,
        section: { schoolId: user.schoolId },
        ...(yearId ? { yearId } : {}),
      },
      select: {
        id: true,
        courseId: true,
        sectionId: true,
        course: { select: { id: true, title: true } },
        section: {
          select: {
            id: true,
            classId: true,
            yearId: true,
            class: { select: { id: true, className: true } },
            sectionTitle: { select: { title: true } },
          },
        },
      },
      orderBy: [
        { section: { class: { className: 'asc' } } },
        { section: { sectionTitle: { title: 'asc' } } },
        { course: { title: 'asc' } },
        { id: 'asc' },
      ],
    });
  }

  private async loadCoefficients(
    yearId: number | null,
    rows: Array<{ section: { classId: number; yearId: number }; courseId: number }>,
  ): Promise<Map<string, number>> {
    if (rows.length === 0) {
      return new Map();
    }

    const keys = new Map<string, { classId: number; yearId: number; courseId: number }>();
    for (const row of rows) {
      const classYearId = yearId ?? row.section.yearId;
      keys.set(`${row.section.classId}:${row.courseId}:${classYearId}`, {
        classId: row.section.classId,
        courseId: row.courseId,
        yearId: classYearId,
      });
    }

    const classCourses = await this.prisma.classCourse.findMany({
      where: {
        status: true,
        OR: [...keys.values()].map((item) => ({
          classId: item.classId,
          courseId: item.courseId,
          yearId: item.yearId,
        })),
      },
      select: { classId: true, courseId: true, yearId: true, coefficient: true },
    });

    return new Map(
      classCourses.map((row) => [
        `${row.classId}:${row.courseId}:${row.yearId}`,
        Number(row.coefficient),
      ]),
    );
  }

  private groupOptions(
    teaches: AssignedTeach[],
    coefficientByKey: Map<string, number>,
    yearId: number | null,
  ): TeacherGradeClassOptionDto[] {
    const classes = new Map<number, TeacherGradeClassOptionDto>();

    for (const teach of teaches) {
      const classId = teach.section.class.id;
      let classOption = classes.get(classId);
      if (!classOption) {
        classOption = {
          id: classId,
          name: teach.section.class.className,
          sections: [],
        };
        classes.set(classId, classOption);
      }

      let sectionOption = classOption.sections.find(
        (section) => section.id === teach.section.id,
      );
      if (!sectionOption) {
        sectionOption = {
          id: teach.section.id,
          title: teach.section.sectionTitle.title,
          courses: [],
        };
        classOption.sections.push(sectionOption);
      }

      if (sectionOption.courses.some((course) => course.id === teach.course.id)) {
        continue;
      }

      sectionOption.courses.push({
        id: teach.course.id,
        title: teach.course.title,
        assignmentId: teach.id,
        coefficient: this.coefficientOf(
          coefficientByKey,
          teach.section.classId,
          teach.courseId,
          teach.section.yearId,
          yearId,
        ),
      });
    }

    return [...classes.values()];
  }

  private coefficientOf(
    coefficientByKey: Map<string, number>,
    classId: number,
    courseId: number,
    rowYearId: number,
    currentYearId: number | null,
  ): number {
    return (
      coefficientByKey.get(
        `${classId}:${courseId}:${currentYearId ?? rowYearId}`,
      ) ?? 1
    );
  }

  private uniquePairs(teaches: AssignedTeach[]) {
    const seen = new Set<string>();
    const pairs: Array<{ sectionId: number; courseId: number }> = [];
    for (const teach of teaches) {
      const key = `${teach.sectionId}:${teach.courseId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      pairs.push({ sectionId: teach.sectionId, courseId: teach.courseId });
    }
    return pairs;
  }

  private toSheetItem(
    row: {
      id: number;
      courseId: number;
      maxGrade: Prisma.Decimal;
      publishDate: Date | null;
      course: { id: number; title: string };
      gradeType: { id: number; title: string };
      section: {
        id: number;
        classId: number;
        yearId: number;
        class: { id: number; className: string };
        sectionTitle: { title: string };
      };
      _count: { details: number };
    },
    coefficientByKey: Map<string, number>,
    yearId: number | null,
  ): TeacherGradeSheetItemDto {
    return {
      id: row.id,
      classId: row.section.class.id,
      className: row.section.class.className,
      sectionId: row.section.id,
      sectionTitle: row.section.sectionTitle.title,
      classLabel: formatClassLabel(
        row.section.class.className,
        row.section.sectionTitle.title,
      ),
      courseId: row.course.id,
      courseTitle: row.course.title,
      gradeTypeId: row.gradeType.id,
      gradeTypeTitle: row.gradeType.title,
      maxGrade: Number(row.maxGrade),
      coefficient: this.coefficientOf(
        coefficientByKey,
        row.section.classId,
        row.courseId,
        row.section.yearId,
        yearId,
      ),
      publishDate: row.publishDate ? formatDateOnly(row.publishDate) : null,
      entriesCount: row._count.details,
    };
  }

  private async assertAssignedCourse(
    user: AuthenticatedTeacher,
    sectionId: number,
    courseId: number,
  ): Promise<AssignedTeach> {
    this.teacherAccess.ensureTeacherRole(user);
    const yearId = await this.teacherAccess.currentYearId(user.schoolId);
    const assignment = await this.prisma.teach.findFirst({
      where: {
        teacherId: user.teacherId,
        sectionId,
        courseId,
        section: { schoolId: user.schoolId },
        ...(yearId ? { yearId } : {}),
      },
      select: {
        id: true,
        courseId: true,
        sectionId: true,
        course: { select: { id: true, title: true } },
        section: {
          select: {
            id: true,
            classId: true,
            yearId: true,
            class: { select: { id: true, className: true } },
            sectionTitle: { select: { title: true } },
          },
        },
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'You are not assigned to this class, section, and course',
      );
    }

    return assignment;
  }

  private async assertGradeType(schoolId: number, gradeTypeId: number) {
    const gradeType = await this.prisma.gradeType.findFirst({
      where: {
        id: gradeTypeId,
        status: true,
        OR: [{ schoolId }, { schoolId: null }],
      },
      select: { id: true, title: true },
    });
    if (!gradeType) {
      throw new NotFoundException('Grade type not found');
    }
    return gradeType;
  }
}
