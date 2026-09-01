import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardRegistrationDto } from './dto/create-dashboard-registration.dto';
import { DashboardRegistrationsQueryDto } from './dto/dashboard-registrations-query.dto';
import {
  DashboardRegistrationItemDto,
  DashboardRegistrationsResponseDto,
} from './dto/dashboard-registrations-response.dto';

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
      class: { select: { className: true } },
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
    class: { className: string };
    sectionTitle: { title: string };
    year: { id: number; title: string };
  };
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
      query.yearId ?? (await this.currentYearId(user.schoolId)) ?? undefined;
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
    return {
      status: true,
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      section: {
        schoolId,
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.yearId ? { yearId: query.yearId } : {}),
      },
      ...(search
        ? {
            OR: [
              {
                student: {
                  person: {
                    OR: [
                      {
                        firstName: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        middleName: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        lastName: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
              ...( /^\d+$/.test(search)
                ? [{ studentId: Number(search) }]
                : []),
            ],
          }
        : {}),
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
