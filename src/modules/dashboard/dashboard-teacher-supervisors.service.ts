import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { personNameContainsFilter } from './person-name-search';
import { CreateDashboardTeacherSupervisorDto } from './dto/create-dashboard-teacher-supervisor.dto';
import { DashboardTeacherSupervisorsQueryDto } from './dto/dashboard-teacher-supervisors-query.dto';
import {
  DashboardTeacherSupervisorCreateResponseDto,
  DashboardTeacherSupervisorItemDto,
  DashboardTeacherSupervisorsResponseDto,
} from './dto/dashboard-teacher-supervisors-response.dto';
import { UpdateDashboardTeacherSupervisorDto } from './dto/update-dashboard-teacher-supervisor.dto';

const supervisorInclude = {
  teacher: {
    select: {
      id: true,
      person: {
        select: { firstName: true, middleName: true, lastName: true },
      },
    },
  },
  class: {
    select: {
      id: true,
      className: true,
      stage: { select: { schoolId: true } },
    },
  },
  year: { select: { id: true, title: true, isCurrent: true, schoolId: true } },
} as const;

type SupervisorRecord = {
  id: number;
  teacherId: number;
  classId: number;
  yearId: number;
  teacher: {
    id: number;
    person: { firstName: string; middleName: string; lastName: string };
  };
  class: {
    id: number;
    className: string;
    stage: { schoolId: number };
  };
  year: { id: number; title: string; isCurrent: boolean; schoolId: number };
};

@Injectable()
export class DashboardTeacherSupervisorsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSupervisors(
    user: AuthenticatedSchool,
    query: DashboardTeacherSupervisorsQueryDto,
  ): Promise<DashboardTeacherSupervisorsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const yearId =
      query.yearId ?? (await this.currentYearId(user.schoolId));
    const where = this.buildWhere(user.schoolId, {
      ...query,
      yearId: yearId ?? undefined,
    });
    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.teacherSupervisor.count({ where }),
      this.prisma.teacherSupervisor.findMany({
        where,
        include: supervisorInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toItem(row as unknown as SupervisorRecord)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getSupervisor(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardTeacherSupervisorItemDto> {
    return this.toItem(await this.findVisible(user.schoolId, id));
  }

  async createSupervisor(
    user: AuthenticatedSchool,
    dto: CreateDashboardTeacherSupervisorDto,
  ): Promise<DashboardTeacherSupervisorCreateResponseDto> {
    const yearId =
      dto.yearId ?? (await this.currentYearId(user.schoolId)) ?? undefined;
    if (!yearId) {
      throw new BadRequestException('Year is required');
    }
    await this.assertYear(user.schoolId, yearId);
    await this.assertTeacher(user.schoolId, dto.teacherId);
    const classIds = this.resolveClassIds(dto);
    await this.assertClasses(user.schoolId, classIds);

    const toCreate: number[] = [];
    for (const classId of classIds) {
      const existing = await this.prisma.teacherSupervisor.findFirst({
        where: {
          teacherId: dto.teacherId,
          classId,
          yearId,
        },
        select: { id: true },
      });
      if (!existing) {
        toCreate.push(classId);
      }
    }

    if (toCreate.length === 0) {
      throw new BadRequestException(
        'This teacher already supervises the selected classes',
      );
    }

    const rows = await this.prisma.$transaction(
      toCreate.map((classId) =>
        this.prisma.teacherSupervisor.create({
          data: {
            teacherId: dto.teacherId,
            classId,
            yearId,
          },
          include: supervisorInclude,
        }),
      ),
    );

    return {
      items: rows.map((row) => this.toItem(row as unknown as SupervisorRecord)),
    };
  }

  async updateSupervisor(
    user: AuthenticatedSchool,
    id: number,
    dto: UpdateDashboardTeacherSupervisorDto,
  ): Promise<DashboardTeacherSupervisorItemDto> {
    const existing = await this.findVisible(user.schoolId, id);
    const classId = dto.classId ?? existing.classId;
    const teacherId = dto.teacherId ?? existing.teacherId;
    const yearId = dto.yearId ?? existing.yearId;
    await this.assertYear(user.schoolId, yearId);
    await this.assertTeacher(user.schoolId, teacherId);
    await this.assertClasses(user.schoolId, [classId]);
    await this.assertUnique(teacherId, classId, yearId, id);

    const row = await this.prisma.teacherSupervisor.update({
      where: { id },
      data: { teacherId, classId, yearId },
      include: supervisorInclude,
    });
    return this.toItem(row as unknown as SupervisorRecord);
  }

  async deleteSupervisor(user: AuthenticatedSchool, id: number): Promise<void> {
    await this.findVisible(user.schoolId, id);
    await this.prisma.teacherSupervisor.delete({ where: { id } });
  }

  private async findVisible(
    schoolId: number,
    id: number,
  ): Promise<SupervisorRecord> {
    const row = await this.prisma.teacherSupervisor.findFirst({
      where: {
        id,
        year: { schoolId },
        class: { stage: { schoolId } },
        teacher: { schools: { some: { schoolId, isActive: true } } },
      },
      include: supervisorInclude,
    });
    if (!row) {
      throw new NotFoundException('Supervisor assignment not found');
    }
    return row as unknown as SupervisorRecord;
  }

  private toItem(row: SupervisorRecord): DashboardTeacherSupervisorItemDto {
    return {
      id: row.id,
      teacherId: row.teacherId,
      teacherName: this.formatName(row.teacher.person),
      classId: row.classId,
      className: row.class.className,
      yearId: row.yearId,
      yearTitle: row.year.title,
      isCurrentYear: row.year.isCurrent,
    };
  }

  private formatName(person: {
    firstName: string;
    middleName: string;
    lastName: string;
  }): string {
    return [person.firstName, person.middleName, person.lastName]
      .filter(Boolean)
      .join(' ');
  }

  private resolveClassIds(dto: CreateDashboardTeacherSupervisorDto): number[] {
    const ids = [
      ...(dto.classIds ?? []),
      ...(dto.classId ? [dto.classId] : []),
    ];
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      throw new BadRequestException('Select at least one class');
    }
    return unique;
  }

  private async assertTeacher(
    schoolId: number,
    teacherId: number,
  ): Promise<void> {
    const item = await this.prisma.teacher.findFirst({
      where: {
        id: teacherId,
        schools: { some: { schoolId, isActive: true } },
      },
      select: { id: true },
    });
    if (!item) {
      throw new BadRequestException('Teacher not found');
    }
  }

  private async assertClasses(
    schoolId: number,
    classIds: number[],
  ): Promise<void> {
    const items = await this.prisma.class.findMany({
      where: { id: { in: classIds }, stage: { schoolId } },
      select: { id: true },
    });
    if (items.length !== classIds.length) {
      throw new BadRequestException('One or more classes were not found');
    }
  }

  private async assertYear(schoolId: number, yearId: number): Promise<void> {
    const item = await this.prisma.year.findFirst({
      where: { id: yearId, schoolId },
      select: { id: true },
    });
    if (!item) {
      throw new BadRequestException('Year not found');
    }
  }

  private async assertUnique(
    teacherId: number,
    classId: number,
    yearId: number,
    excludeId?: number,
  ): Promise<void> {
    const clash = await this.prisma.teacherSupervisor.findFirst({
      where: {
        teacherId,
        classId,
        yearId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(
        'This teacher already supervises that class this year',
      );
    }
  }

  private async currentYearId(schoolId: number): Promise<number | null> {
    const year = await this.prisma.year.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });
    return year?.id ?? null;
  }

  private buildWhere(
    schoolId: number,
    query: DashboardTeacherSupervisorsQueryDto,
  ): Prisma.TeacherSupervisorWhereInput {
    const search = query.search?.trim();
    const teacherNameMatch = personNameContainsFilter(search);
    return {
      year: { schoolId },
      class: { stage: { schoolId } },
      teacher: { schools: { some: { schoolId, isActive: true } } },
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.yearId ? { yearId: query.yearId } : {}),
      ...(search
        ? {
            OR: [
              ...(teacherNameMatch
                ? [{ teacher: { person: teacherNameMatch } }]
                : []),
              {
                class: {
                  className: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    sortBy?: DashboardTeacherSupervisorsQueryDto['sortBy'],
    sortOrder?: DashboardTeacherSupervisorsQueryDto['sortOrder'],
  ): Prisma.TeacherSupervisorOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder = sortOrder === 'desc' ? 'desc' : 'asc';
    if (sortBy === 'teacher') {
      return [
        { teacher: { person: { firstName: direction } } },
        { id: direction },
      ];
    }
    if (sortBy === 'class') {
      return [{ class: { className: direction } }, { id: direction }];
    }
    if (sortBy === 'year') {
      return [{ year: { title: direction } }, { id: direction }];
    }
    return [{ id: direction }];
  }
}
