import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { personNameContainsFilter } from './person-name-search';
import { CreateDashboardRegistrationDto } from './dto/create-dashboard-registration.dto';
import { DashboardRegistrationsQueryDto } from './dto/dashboard-registrations-query.dto';
import {
  DashboardRegistrationItemDto,
  DashboardRegistrationsResponseDto,
} from './dto/dashboard-registrations-response.dto';
import {
  BulkProgressDashboardRegistrationDto,
  BulkProgressRegistrationsResponseDto,
  ProgressDashboardRegistrationDto,
} from './dto/progress-dashboard-registration.dto';

const DASHBOARD_CREATOR_PERSON_ID = 1;

const registrationInclude = {
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
      class: { select: { className: true, classLevel: true } },
      sectionTitle: { select: { title: true } },
      year: { select: { id: true, title: true } },
    },
  },
} as const;

type RegistrationRecord = {
  id: number;
  createdAt: Date;
  student: {
    id: number;
    person: {
      firstName: string;
      middleName: string;
      lastName: string;
    };
  };
  section: {
    id: number;
    classId: number;
    class: { className: string; classLevel: number };
    sectionTitle: { title: string };
    year: { id: number; title: string };
  };
};

type ClassProgressRow = {
  id: number;
  className: string;
  classLevel: number;
  stageId: number;
  position: number;
  stage: { position: number };
};

@Injectable()
export class DashboardRegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listRegistrations(
    user: AuthenticatedSchool,
    query: DashboardRegistrationsQueryDto,
  ): Promise<DashboardRegistrationsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const yearId =
      query.yearId !== undefined
        ? query.yearId
        : query.studentId
          ? undefined
          : ((await this.currentYearId(user.schoolId)) ?? undefined);
    const where = this.buildWhere(user.schoolId, { ...query, yearId });
    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.registration.count({ where }),
      this.prisma.registration.findMany({
        where,
        include: registrationInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) =>
        this.toItem(row as unknown as RegistrationRecord),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getRegistration(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardRegistrationItemDto> {
    const row = await this.findRegistrationForSchool(user.schoolId, id);
    return this.toItem(row as unknown as RegistrationRecord);
  }

  async createRegistration(
    user: AuthenticatedSchool,
    dto: CreateDashboardRegistrationDto,
  ): Promise<DashboardRegistrationItemDto> {
    await this.assertCreatorPersonExists();

    const student = await this.prisma.student.findFirst({
      where: {
        id: dto.studentId,
        person: { schoolId: user.schoolId },
      },
      select: { id: true },
    });
    if (!student) {
      throw new BadRequestException('Student not found');
    }

    const section = await this.prisma.section.findFirst({
      where: {
        id: dto.sectionId,
        schoolId: user.schoolId,
        classId: dto.classId,
        status: 1,
      },
      select: { id: true },
    });
    if (!section) {
      throw new BadRequestException(
        'Section not found for the selected class',
      );
    }

    const duplicate = await this.prisma.registration.findFirst({
      where: {
        studentId: dto.studentId,
        sectionId: dto.sectionId,
        status: true,
        section: { schoolId: user.schoolId },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException(
        'This student is already registered in this section',
      );
    }

    const created = await this.prisma.registration.create({
      data: {
        schoolId: user.schoolId,
        studentId: dto.studentId,
        sectionId: dto.sectionId,
        personId: DASHBOARD_CREATOR_PERSON_ID,
        status: true,
      },
      include: registrationInclude,
    });

    return this.toItem(created as unknown as RegistrationRecord);
  }

  async progressRegistration(
    user: AuthenticatedSchool,
    id: number,
    dto: ProgressDashboardRegistrationDto,
  ): Promise<DashboardRegistrationItemDto> {
    await this.assertCreatorPersonExists();
    return this.progressOne(user.schoolId, id, dto.action);
  }

  async bulkProgressRegistrations(
    user: AuthenticatedSchool,
    dto: BulkProgressDashboardRegistrationDto,
  ): Promise<BulkProgressRegistrationsResponseDto> {
    await this.assertCreatorPersonExists();

    const items: BulkProgressRegistrationsResponseDto['items'] = [];

    for (const registrationId of dto.registrationIds) {
      const studentName = await this.resolveStudentName(
        user.schoolId,
        registrationId,
      );

      try {
        const created = await this.progressOne(
          user.schoolId,
          registrationId,
          dto.action,
        );
        items.push({
          registrationId,
          studentName: created.studentName || studentName,
          ok: true,
          message: `${created.yearTitle} · ${created.className} · Level ${created.classLevel} · ${created.sectionTitle}`,
          created,
        });
      } catch (error) {
        items.push({
          registrationId,
          studentName,
          ok: false,
          message: this.toErrorMessage(error),
        });
      }
    }

    return {
      items,
      successCount: items.filter((item) => item.ok).length,
      failCount: items.filter((item) => !item.ok).length,
    };
  }

  async deleteRegistration(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<void> {
    await this.findRegistrationForSchool(user.schoolId, id);
    await this.prisma.registration.update({
      where: { id },
      data: { status: false },
    });
  }

  private async progressOne(
    schoolId: number,
    id: number,
    action: ProgressDashboardRegistrationDto['action'],
  ): Promise<DashboardRegistrationItemDto> {
    const current = await this.prisma.registration.findFirst({
      where: {
        id,
        status: true,
        section: { schoolId },
      },
      select: {
        id: true,
        studentId: true,
        section: {
          select: {
            classId: true,
            year: { select: { id: true, title: true } },
            class: {
              select: {
                id: true,
                className: true,
                classLevel: true,
                stageId: true,
                position: true,
                stage: { select: { position: true } },
              },
            },
          },
        },
      },
    });

    if (!current) {
      throw new NotFoundException('Registration not found');
    }

    const nextYear = await this.resolveNextYear(
      schoolId,
      current.section.year,
    );
    const targetClass = await this.resolveTargetClass(
      schoolId,
      current.section.class,
      action,
    );
    const targetSection = await this.resolveFirstSection(
      schoolId,
      targetClass.id,
      nextYear.id,
      targetClass.className,
      nextYear.title,
    );

    const duplicate = await this.prisma.registration.findFirst({
      where: {
        studentId: current.studentId,
        sectionId: targetSection.id,
        status: true,
        section: { schoolId },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException(
        'This student is already registered in that section for the next year',
      );
    }

    const created = await this.prisma.registration.create({
      data: {
        schoolId,
        studentId: current.studentId,
        sectionId: targetSection.id,
        personId: DASHBOARD_CREATOR_PERSON_ID,
        status: true,
      },
      include: registrationInclude,
    });

    return this.toItem(created as unknown as RegistrationRecord);
  }

  private async resolveStudentName(
    schoolId: number,
    registrationId: number,
  ): Promise<string> {
    const row = await this.prisma.registration.findFirst({
      where: {
        id: registrationId,
        section: { schoolId },
      },
      select: {
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

    if (!row) {
      return `Registration #${registrationId}`;
    }

    return this.formatPersonName(row.student.person);
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const message = (response as { message: string | string[] }).message;
        return Array.isArray(message) ? message.join(', ') : message;
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Could not progress registration';
  }

  private async findRegistrationForSchool(schoolId: number, id: number) {
    const row = await this.prisma.registration.findFirst({
      where: {
        id,
        status: true,
        section: { schoolId },
      },
      include: registrationInclude,
    });

    if (!row) {
      throw new NotFoundException('Registration not found');
    }

    return row;
  }

  private buildWhere(
    schoolId: number,
    query: DashboardRegistrationsQueryDto & { yearId?: number },
  ): Prisma.RegistrationWhereInput {
    const search = query.search?.trim();
    const nameMatch = personNameContainsFilter(search);
    const firstName = query.firstName?.trim();
    const middleName = query.middleName?.trim();
    const lastName = query.lastName?.trim();

    return {
      status: true,
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      section: {
        schoolId,
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.yearId ? { yearId: query.yearId } : {}),
      },
      AND: [
        search
          ? {
              OR: [
                ...(nameMatch ? [{ student: { person: nameMatch } }] : []),
                ...(/^\d+$/.test(search)
                  ? [{ studentId: Number(search) }]
                  : []),
              ],
            }
          : {},
        firstName
          ? {
              student: {
                person: {
                  firstName: { contains: firstName, mode: 'insensitive' },
                },
              },
            }
          : {},
        middleName
          ? {
              student: {
                person: {
                  middleName: { contains: middleName, mode: 'insensitive' },
                },
              },
            }
          : {},
        lastName
          ? {
              student: {
                person: {
                  lastName: { contains: lastName, mode: 'insensitive' },
                },
              },
            }
          : {},
      ],
    };
  }

  private buildOrderBy(
    sortBy?: DashboardRegistrationsQueryDto['sortBy'],
    sortOrder?: DashboardRegistrationsQueryDto['sortOrder'],
  ): Prisma.RegistrationOrderByWithRelationInput[] {
    const direction = sortOrder === 'desc' ? 'desc' : 'asc';
    const idTieBreaker: Prisma.RegistrationOrderByWithRelationInput = {
      id: 'asc',
    };

    switch (sortBy) {
      case 'student':
        return [
          { student: { person: { firstName: direction } } },
          { student: { person: { lastName: direction } } },
          idTieBreaker,
        ];
      case 'class':
        return [{ section: { class: { className: direction } } }, idTieBreaker];
      case 'section':
        return [
          { section: { sectionTitle: { title: direction } } },
          idTieBreaker,
        ];
      case 'year':
        return [{ section: { year: { title: direction } } }, idTieBreaker];
      case 'date':
        return [{ createdAt: direction }, idTieBreaker];
      case 'id':
      default:
        return [{ id: direction }];
    }
  }

  private toItem(row: RegistrationRecord): DashboardRegistrationItemDto {
    return {
      id: row.id,
      studentId: row.student.id,
      studentName: this.formatPersonName(row.student.person),
      classId: row.section.classId,
      className: row.section.class.className,
      classLevel: row.section.class.classLevel,
      sectionId: row.section.id,
      sectionTitle: row.section.sectionTitle.title,
      yearId: row.section.year.id,
      yearTitle: row.section.year.title,
      createdAt: row.createdAt.toISOString(),
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

  private async currentYearId(schoolId: number): Promise<number | null> {
    const year = await this.prisma.year.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });
    return year?.id ?? null;
  }

  private async resolveNextYear(
    schoolId: number,
    fromYear: { id: number; title: string },
  ): Promise<{ id: number; title: string }> {
    const years = await this.prisma.year.findMany({
      where: { schoolId },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    });

    const fromStart = this.parseYearStart(fromYear.title);
    if (fromStart != null) {
      const nextByStart = years.find((year) => {
        if (year.id === fromYear.id) {
          return false;
        }
        return this.parseYearStart(year.title) === fromStart + 1;
      });
      if (nextByStart) {
        return nextByStart;
      }
    }

    const nextByTitle = years.find(
      (year) => year.id !== fromYear.id && year.title > fromYear.title,
    );
    if (nextByTitle) {
      return nextByTitle;
    }

    throw new BadRequestException(
      'Next school year not found. Create the next year first.',
    );
  }

  private parseYearStart(title: string): number | null {
    const match = title.trim().match(/^(\d{4})\s*[-/]\s*\d{4}$/);
    if (!match) {
      return null;
    }
    return Number(match[1]);
  }

  private async resolveTargetClass(
    schoolId: number,
    currentClass: ClassProgressRow,
    action: ProgressDashboardRegistrationDto['action'],
  ): Promise<ClassProgressRow> {
    if (action === 'stay') {
      return currentClass;
    }

    const classes = await this.prisma.class.findMany({
      where: { stage: { schoolId } },
      select: {
        id: true,
        className: true,
        classLevel: true,
        stageId: true,
        position: true,
        stage: { select: { position: true } },
      },
      orderBy: [
        { stage: { position: 'asc' } },
        { classLevel: 'asc' },
        { position: 'asc' },
        { id: 'asc' },
      ],
    });

    const currentIndex = classes.findIndex(
      (item) => item.id === currentClass.id,
    );
    if (currentIndex < 0) {
      throw new BadRequestException('Current class not found');
    }

    if (action === 'up') {
      const sameStageNext = classes.find(
        (item) =>
          item.stageId === currentClass.stageId &&
          item.classLevel === currentClass.classLevel + 1,
      );
      if (sameStageNext) {
        return sameStageNext;
      }
      const nextInOrder = classes[currentIndex + 1];
      if (nextInOrder) {
        return nextInOrder;
      }
      throw new BadRequestException('No higher class level available');
    }

    const sameStagePrev = classes
      .slice()
      .reverse()
      .find(
        (item) =>
          item.stageId === currentClass.stageId &&
          item.classLevel === currentClass.classLevel - 1,
      );
    if (sameStagePrev) {
      return sameStagePrev;
    }
    const previousInOrder = classes[currentIndex - 1];
    if (previousInOrder) {
      return previousInOrder;
    }
    throw new BadRequestException('No lower class level available');
  }

  private async resolveFirstSection(
    schoolId: number,
    classId: number,
    yearId: number,
    className: string,
    yearTitle: string,
  ): Promise<{ id: number }> {
    const section = await this.prisma.section.findFirst({
      where: {
        schoolId,
        classId,
        yearId,
        status: 1,
      },
      orderBy: [{ sectionTitle: { title: 'asc' } }, { id: 'asc' }],
      select: { id: true },
    });

    if (!section) {
      throw new BadRequestException(
        `No section found for ${className} in ${yearTitle}. Create a section first.`,
      );
    }

    return section;
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
