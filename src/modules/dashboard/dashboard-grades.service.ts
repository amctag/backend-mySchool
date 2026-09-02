import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DashboardGradesByCourseQueryDto } from './dto/dashboard-grades-by-course-query.dto';
import {
  DashboardGradeByCourseCandidatesResponseDto,
  DashboardGradeByCourseDetailResponseDto,
  DashboardGradeByCourseItemDto,
  DashboardGradesByCourseResponseDto,
} from './dto/dashboard-grades-by-course-response.dto';
import { DashboardGradeTypesListResponseDto } from './dto/dashboard-grade-types-list-response.dto';
import { DashboardGradeCardQueryDto } from './dto/dashboard-grade-card-query.dto';
import {
  DashboardGradeCardResponseDto,
  DashboardGradeCardCellDto,
} from './dto/dashboard-grade-card-response.dto';
import { SaveDashboardGradeByCourseDto } from './dto/save-dashboard-grade-by-course.dto';

const DASHBOARD_CREATOR_PERSON_ID = 1;
const DEFAULT_MAX_GRADE = 100;

const gradeSheetInclude = {
  course: { select: { id: true, title: true } },
  gradeType: { select: { id: true, title: true } },
  section: {
    select: {
      id: true,
      classId: true,
      class: { select: { className: true } },
      sectionTitle: { select: { title: true } },
      year: { select: { id: true, title: true } },
    },
  },
  details: {
    include: {
      registration: {
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
    orderBy: [{ id: 'asc' }],
  },
} satisfies Prisma.GradeInclude;

type GradeSheetRecord = {
  id: number;
  maxGrade: Prisma.Decimal;
  publishDate: Date | null;
  createdAt: Date;
  course: { id: number; title: string };
  gradeType: { id: number; title: string };
  section: {
    id: number;
    classId: number;
    class: { className: string };
    sectionTitle: { title: string };
    year: { id: number; title: string };
  };
  details: Array<{
    id: number;
    registrationId: number;
    grade: Prisma.Decimal | null;
    comment: string | null;
    registration: {
      student: {
        id: number;
        person: {
          firstName: string;
          middleName: string;
          lastName: string;
        };
      };
    };
  }>;
};

@Injectable()
export class DashboardGradesService {
  constructor(private readonly prisma: PrismaService) {}

  async listGradeTypes(
    user: AuthenticatedSchool,
  ): Promise<DashboardGradeTypesListResponseDto> {
    const items = await this.prisma.gradeType.findMany({
      where: {
        status: true,
        OR: [{ schoolId: user.schoolId }, { schoolId: null }],
      },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
      },
    });

    return { items };
  }

  async getGradeCard(
    user: AuthenticatedSchool,
    query: DashboardGradeCardQueryDto,
  ): Promise<DashboardGradeCardResponseDto> {
    const registration = await this.prisma.registration.findFirst({
      where: {
        id: query.registrationId,
        schoolId: user.schoolId,
        status: true,
      },
      include: {
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
        section: {
          select: {
            id: true,
            classId: true,
            yearId: true,
            class: { select: { className: true } },
            sectionTitle: { select: { title: true } },
            year: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    const { section } = registration;

    if (query.sectionId !== undefined && section.id !== query.sectionId) {
      throw new BadRequestException(
        'Registration does not match the selected section',
      );
    }
    if (query.classId !== undefined && section.classId !== query.classId) {
      throw new BadRequestException(
        'Registration does not match the selected class',
      );
    }
    if (query.yearId !== undefined && section.yearId !== query.yearId) {
      throw new BadRequestException(
        'Registration does not match the selected year',
      );
    }

    const [gradeFormRow, classCourses] = await Promise.all([
      this.prisma.gradeForm.findFirst({
        where: {
          schoolId: user.schoolId,
          yearId: section.yearId,
          status: true,
          classes: { some: { classId: section.classId } },
        },
        orderBy: [{ id: 'desc' }],
        select: {
          id: true,
          title: true,
          direction: true,
          tableFormat: true,
          average: true,
        },
      }),
      this.prisma.classCourse.findMany({
        where: {
          classId: section.classId,
          yearId: section.yearId,
          status: true,
        },
        include: {
          course: { select: { id: true, title: true } },
        },
        orderBy: [{ course: { title: 'asc' } }, { id: 'asc' }],
      }),
    ]);

    const gradeFormDetails =
      gradeFormRow === null
        ? []
        : await this.prisma.gradeFormDetail.findMany({
            where: {
              gradeFormId: gradeFormRow.id,
              status: true,
              isVisible: true,
            },
            include: { gradeType: { select: { id: true, title: true } } },
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
          });

    const courseIds = classCourses.map((item) => item.courseId);
    const gradeTypeIds = gradeFormDetails.map((item) => item.gradeTypeId);

    const gradeDetails =
      courseIds.length > 0
        ? await this.prisma.gradeDetail.findMany({
            where: {
              registrationId: registration.id,
              gradeSheet: {
                schoolId: user.schoolId,
                sectionId: section.id,
                courseId: { in: courseIds },
                ...(gradeTypeIds.length > 0
                  ? { gradeTypeId: { in: gradeTypeIds } }
                  : {}),
              },
            },
            select: {
              grade: true,
              comment: true,
              gradeSheet: {
                select: {
                  courseId: true,
                  gradeTypeId: true,
                  maxGrade: true,
                },
              },
            },
          })
        : [];

    const allowedCourseIds = new Set(courseIds);
    const allowedGradeTypeIds = new Set(gradeTypeIds);

    const cells: Record<string, DashboardGradeCardCellDto> = {};
    for (const detail of gradeDetails) {
      const { courseId, gradeTypeId, maxGrade } = detail.gradeSheet;
      if (
        !allowedCourseIds.has(courseId) ||
        (allowedGradeTypeIds.size > 0 &&
          !allowedGradeTypeIds.has(gradeTypeId))
      ) {
        continue;
      }

      const key = `${courseId}-${gradeTypeId}`;
      cells[key] = {
        score: detail.grade == null ? null : Number(detail.grade),
        maxGrade: Number(maxGrade),
        comment: detail.comment ?? null,
      };
    }

    return {
      student: {
        registrationId: registration.id,
        studentId: registration.student.id,
        studentName: this.formatPersonName(registration.student.person),
        classId: section.classId,
        className: section.class.className,
        sectionId: section.id,
        sectionTitle: section.sectionTitle.title,
        yearId: section.year.id,
        yearTitle: section.year.title,
      },
      gradeForm: gradeFormRow
        ? {
            id: gradeFormRow.id,
            title: gradeFormRow.title,
            direction: gradeFormRow.direction,
            tableFormat: gradeFormRow.tableFormat,
            average: gradeFormRow.average,
          }
        : null,
      courses: classCourses.map((item) => ({
        classCourseId: item.id,
        courseId: item.courseId,
        courseTitle: item.course.title,
        coefficient: Number(item.coefficient),
      })),
      gradeTypes: gradeFormDetails.map((item) => ({
        detailId: item.id,
        gradeTypeId: item.gradeTypeId,
        gradeTypeTitle: item.gradeType.title,
        position: item.position,
      })),
      cells,
    };
  }

  async listGradesByCourse(
    user: AuthenticatedSchool,
    query: DashboardGradesByCourseQueryDto,
  ): Promise<DashboardGradesByCourseResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const yearId =
      query.yearId ?? (await this.currentYearId(user.schoolId)) ?? undefined;
    const where = this.buildWhere(user.schoolId, { ...query, yearId });
    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder);

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
              class: { select: { className: true } },
              sectionTitle: { select: { title: true } },
              year: { select: { id: true, title: true } },
            },
          },
          _count: { select: { details: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toListItem(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getGradeByCourse(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardGradeByCourseDetailResponseDto> {
    const row = await this.findGradeSheetForSchool(user.schoolId, id);
    return this.toDetail(row as unknown as GradeSheetRecord);
  }

  async getGradeByCourseCandidates(
    user: AuthenticatedSchool,
    sectionId: number,
    courseId: number,
    gradeTypeId: number,
  ): Promise<DashboardGradeByCourseCandidatesResponseDto> {
    const section = await this.findSectionForSchool(user.schoolId, sectionId);
    await this.assertCourseForSection(section, courseId);
    await this.assertGradeType(user.schoolId, gradeTypeId);

    const registrations = await this.prisma.registration.findMany({
      where: {
        sectionId,
        status: true,
        schoolId: user.schoolId,
      },
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
      orderBy: [
        { student: { person: { firstName: 'asc' } } },
        { student: { person: { lastName: 'asc' } } },
        { id: 'asc' },
      ],
    });

    const existing = await this.prisma.grade.findFirst({
      where: {
        schoolId: user.schoolId,
        sectionId,
        courseId,
        gradeTypeId,
      },
      include: {
        details: {
          select: {
            registrationId: true,
            grade: true,
            comment: true,
          },
        },
      },
    });

    const detailByRegistration = new Map(
      (existing?.details ?? []).map((detail) => [
        detail.registrationId,
        detail,
      ]),
    );

    return {
      gradeSheetId: existing?.id ?? null,
      maxGrade: existing ? Number(existing.maxGrade) : DEFAULT_MAX_GRADE,
      publishDate: existing?.publishDate
        ? this.formatDateOnly(existing.publishDate)
        : this.formatDateOnly(new Date()),
      students: registrations.map((registration) => {
        const detail = detailByRegistration.get(registration.id);
        return {
          registrationId: registration.id,
          studentId: registration.student.id,
          studentName: this.formatPersonName(registration.student.person),
          grade: detail?.grade == null ? null : Number(detail.grade),
          comment: detail?.comment ?? null,
        };
      }),
    };
  }

  async saveGradeByCourse(
    user: AuthenticatedSchool,
    body: SaveDashboardGradeByCourseDto,
  ): Promise<DashboardGradeByCourseDetailResponseDto> {
    await this.assertCreatorPersonExists();

    const section = await this.findSectionForSchool(
      user.schoolId,
      body.sectionId,
    );
    await this.assertCourseForSection(section, body.courseId);
    await this.assertGradeType(user.schoolId, body.gradeTypeId);

    const registrationIds = new Set(
      (
        await this.prisma.registration.findMany({
          where: {
            sectionId: body.sectionId,
            schoolId: user.schoolId,
            status: true,
          },
          select: { id: true },
        })
      ).map((item) => item.id),
    );

    for (const entry of body.entries) {
      if (!registrationIds.has(entry.registrationId)) {
        throw new BadRequestException(
          `Registration ${entry.registrationId} is not in this section`,
        );
      }
      if (entry.grade != null && entry.grade > body.maxGrade) {
        throw new BadRequestException(
          `Grade cannot be greater than max grade (${body.maxGrade})`,
        );
      }
    }

    const publishDate = body.publishDate
      ? new Date(`${body.publishDate}T00:00:00.000Z`)
      : null;

    const gradeId = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.grade.findFirst({
        where: {
          schoolId: user.schoolId,
          sectionId: body.sectionId,
          courseId: body.courseId,
          gradeTypeId: body.gradeTypeId,
        },
        select: { id: true },
      });

      let sheetId: number;
      if (existing) {
        await tx.grade.update({
          where: { id: existing.id },
          data: {
            maxGrade: body.maxGrade,
            publishDate,
          },
        });
        sheetId = existing.id;
      } else {
        const created = await tx.grade.create({
          data: {
            schoolId: user.schoolId,
            sectionId: body.sectionId,
            courseId: body.courseId,
            gradeTypeId: body.gradeTypeId,
            maxGrade: body.maxGrade,
            publishDate,
            personId: DASHBOARD_CREATOR_PERSON_ID,
          },
        });
        sheetId = created.id;
      }

      for (const entry of body.entries) {
        const hasValue =
          entry.grade != null ||
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
            grade: entry.grade ?? null,
            comment: entry.comment?.trim() || null,
          },
          update: {
            grade: entry.grade ?? null,
            comment: entry.comment?.trim() || null,
          },
        });
      }

      return sheetId;
    });

    return this.getGradeByCourse(user, gradeId);
  }

  private async findGradeSheetForSchool(schoolId: number, id: number) {
    const row = await this.prisma.grade.findFirst({
      where: { id, schoolId },
      include: gradeSheetInclude,
    });

    if (!row) {
      throw new NotFoundException('Grade sheet not found');
    }

    return row;
  }

  private async findSectionForSchool(schoolId: number, sectionId: number) {
    const section = await this.prisma.section.findFirst({
      where: {
        id: sectionId,
        schoolId,
        status: 1,
      },
      select: {
        id: true,
        classId: true,
        yearId: true,
      },
    });

    if (!section) {
      throw new BadRequestException('Section not found');
    }

    return section;
  }

  private async assertCourseForSection(
    section: { classId: number; yearId: number },
    courseId: number,
  ): Promise<void> {
    const classCourse = await this.prisma.classCourse.findFirst({
      where: {
        classId: section.classId,
        yearId: section.yearId,
        courseId,
        status: true,
      },
      select: { id: true },
    });

    if (!classCourse) {
      throw new BadRequestException(
        'Course is not assigned to this class for the section year',
      );
    }
  }

  private async assertGradeType(
    schoolId: number,
    gradeTypeId: number,
  ): Promise<void> {
    const gradeType = await this.prisma.gradeType.findFirst({
      where: {
        id: gradeTypeId,
        status: true,
        OR: [{ schoolId }, { schoolId: null }],
      },
      select: { id: true },
    });

    if (!gradeType) {
      throw new BadRequestException('Grade type not found');
    }
  }

  private buildWhere(
    schoolId: number,
    query: DashboardGradesByCourseQueryDto & { yearId?: number },
  ): Prisma.GradeWhereInput {
    const search = query.search?.trim();
    return {
      schoolId,
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.gradeTypeId ? { gradeTypeId: query.gradeTypeId } : {}),
      section: {
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.yearId ? { yearId: query.yearId } : {}),
      },
      ...(search
        ? {
            OR: [
              { course: { title: { contains: search, mode: 'insensitive' } } },
              {
                gradeType: {
                  title: { contains: search, mode: 'insensitive' },
                },
              },
              {
                section: {
                  sectionTitle: {
                    title: { contains: search, mode: 'insensitive' },
                  },
                },
              },
              {
                section: {
                  class: {
                    className: { contains: search, mode: 'insensitive' },
                  },
                },
              },
              {
                section: {
                  year: { title: { contains: search, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    sortBy?: DashboardGradesByCourseQueryDto['sortBy'],
    sortOrder?: DashboardGradesByCourseQueryDto['sortOrder'],
  ): Prisma.GradeOrderByWithRelationInput[] {
    const direction = sortOrder === 'asc' ? 'asc' : 'desc';
    const idTieBreaker: Prisma.GradeOrderByWithRelationInput = { id: 'asc' };

    switch (sortBy) {
      case 'year':
        return [{ section: { year: { title: direction } } }, idTieBreaker];
      case 'course':
        return [{ course: { title: direction } }, idTieBreaker];
      case 'section':
        return [
          { section: { sectionTitle: { title: direction } } },
          idTieBreaker,
        ];
      case 'maxGrade':
        return [{ maxGrade: direction }, idTieBreaker];
      case 'gradeType':
        return [{ gradeType: { title: direction } }, idTieBreaker];
      case 'date':
        return [{ createdAt: direction }, idTieBreaker];
      case 'id':
      default:
        return [{ id: direction }];
    }
  }

  private toListItem(row: {
    id: number;
    maxGrade: Prisma.Decimal;
    publishDate: Date | null;
    createdAt: Date;
    course: { id: number; title: string };
    gradeType: { id: number; title: string };
    section: {
      id: number;
      class: { className: string };
      sectionTitle: { title: string };
      year: { id: number; title: string };
    };
    _count: { details: number };
  }): DashboardGradeByCourseItemDto {
    return {
      id: row.id,
      yearId: row.section.year.id,
      yearTitle: row.section.year.title,
      courseId: row.course.id,
      courseTitle: row.course.title,
      sectionId: row.section.id,
      sectionTitle: row.section.sectionTitle.title,
      className: row.section.class.className,
      gradeTypeId: row.gradeType.id,
      gradeTypeTitle: row.gradeType.title,
      maxGrade: Number(row.maxGrade),
      publishDate: row.publishDate?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      studentCount: row._count.details,
    };
  }

  private toDetail(
    row: GradeSheetRecord,
  ): DashboardGradeByCourseDetailResponseDto {
    return {
      id: row.id,
      yearId: row.section.year.id,
      yearTitle: row.section.year.title,
      classId: row.section.classId,
      className: row.section.class.className,
      courseId: row.course.id,
      courseTitle: row.course.title,
      sectionId: row.section.id,
      sectionTitle: row.section.sectionTitle.title,
      gradeTypeId: row.gradeType.id,
      gradeTypeTitle: row.gradeType.title,
      maxGrade: Number(row.maxGrade),
      publishDate: row.publishDate?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      students: row.details.map((detail) => ({
        registrationId: detail.registrationId,
        studentId: detail.registration.student.id,
        studentName: this.formatPersonName(detail.registration.student.person),
        grade: detail.grade == null ? null : Number(detail.grade),
        comment: detail.comment,
      })),
    };
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
      throw new BadRequestException('Creator person not found');
    }
  }
}
