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
  section: {
    select: {
      id: true,
      classId: true,
      yearId: true,
      schoolId: true,
      class: { select: { className: true } },
      sectionTitle: { select: { title: true } },
    },
  },
  year: { select: { id: true, title: true, isCurrent: true, schoolId: true } },
} as const;

type SupervisorRecord = {
  id: number;
  teacherId: number;
  sectionId: number;
  yearId: number;
  teacher: {
    id: number;
    person: { firstName: string; middleName: string; lastName: string };
  };
  section: {
    id: number;
    classId: number;
    yearId: number;
    schoolId: number;
    class: { className: string };
    sectionTitle: { title: string };
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
    const sections = await this.resolveTargetSections(user.schoolId, dto);
    const yearId = dto.yearId ?? sections[0].yearId;
    if (sections.some((section) => section.yearId !== yearId)) {
      throw new BadRequestException(
        'Year must match the selected class sections',
      );
    }
    if (dto.yearId && dto.yearId !== yearId) {
      throw new BadRequestException(
        'Year must match the selected section year',
      );
    }
    await this.assertYear(user.schoolId, yearId);
    await this.assertTeacher(user.schoolId, dto.teacherId);

    const toCreate: number[] = [];
    for (const section of sections) {
      const existing = await this.prisma.teacherSupervisor.findFirst({
        where: {
          teacherId: dto.teacherId,
          sectionId: section.id,
          yearId,
        },
        select: { id: true },
      });
      if (!existing) {
        toCreate.push(section.id);
      }
    }

    if (toCreate.length === 0) {
      throw new BadRequestException(
        'This teacher already supervises the selected class',
      );
    }

    const rows = await this.prisma.$transaction(
      toCreate.map((sectionId) =>
        this.prisma.teacherSupervisor.create({
          data: {
            teacherId: dto.teacherId,
            sectionId,
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
    const sectionId = dto.sectionId ?? existing.sectionId;
    const teacherId = dto.teacherId ?? existing.teacherId;
    const section = await this.assertSection(user.schoolId, sectionId);
    const yearId = dto.yearId ?? section.yearId;
    if (yearId !== section.yearId) {
      throw new BadRequestException(
        'Year must match the selected section year',
      );
    }
    await this.assertYear(user.schoolId, yearId);
    await this.assertTeacher(user.schoolId, teacherId);
    await this.assertUnique(teacherId, sectionId, yearId, id);

    const row = await this.prisma.teacherSupervisor.update({
      where: { id },
      data: { teacherId, sectionId, yearId },
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
        section: { schoolId },
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
      classId: row.section.classId,
      className: row.section.class.className,
      sectionId: row.sectionId,
      sectionTitle: row.section.sectionTitle.title,
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

  private async assertSection(
    schoolId: number,
    sectionId: number,
  ): Promise<{ yearId: number; classId: number }> {
    const item = await this.prisma.section.findFirst({
      where: { id: sectionId, schoolId },
      select: { id: true, yearId: true, classId: true, status: true },
    });
    if (!item) {
      throw new BadRequestException('Section not found');
    }
    return item;
  }

  private async resolveTargetSections(
    schoolId: number,
    dto: CreateDashboardTeacherSupervisorDto,
  ): Promise<{ id: number; yearId: number; classId: number }[]> {
    if (dto.sectionId) {
      const section = await this.assertSection(schoolId, dto.sectionId);
      if (dto.classId && dto.classId !== section.classId) {
        throw new BadRequestException(
          'Section does not belong to the selected class',
        );
      }
      return [
        { id: dto.sectionId, yearId: section.yearId, classId: section.classId },
      ];
    }
    if (!dto.classId) {
      throw new BadRequestException('Provide classId or sectionId');
    }
    const yearId =
      dto.yearId ?? (await this.currentYearId(schoolId)) ?? undefined;
    if (!yearId) {
      throw new BadRequestException('Year is required');
    }
    const sections = await this.prisma.section.findMany({
      where: { schoolId, classId: dto.classId, yearId },
      select: { id: true, yearId: true, classId: true },
      orderBy: { id: 'asc' },
    });
    if (sections.length === 0) {
      throw new BadRequestException('No sections found for this class');
    }
    return sections;
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
    sectionId: number,
    yearId: number,
    excludeId?: number,
  ): Promise<void> {
    const clash = await this.prisma.teacherSupervisor.findFirst({
      where: {
        teacherId,
        sectionId,
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
      teacher: { schools: { some: { schoolId, isActive: true } } },
      section: {
        schoolId,
        ...(query.classId ? { classId: query.classId } : {}),
      },
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.yearId ? { yearId: query.yearId } : {}),
      ...(search
        ? {
            OR: [
              ...(teacherNameMatch
                ? [{ teacher: { person: teacherNameMatch } }]
                : []),
              {
                section: {
                  class: { className: { contains: search, mode: 'insensitive' } },
                },
              },
              {
                section: {
                  sectionTitle: {
                    title: { contains: search, mode: 'insensitive' },
                  },
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
      return [{ section: { class: { className: direction } } }, { id: direction }];
    }
    if (sortBy === 'section') {
      return [
        { section: { sectionTitle: { title: direction } } },
        { id: direction },
      ];
    }
    if (sortBy === 'year') {
      return [{ year: { title: direction } }, { id: direction }];
    }
    return [{ id: direction }];
  }
}
