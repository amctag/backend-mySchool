import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardTeachDto } from './dto/create-dashboard-teach.dto';
import { DashboardTeachesQueryDto } from './dto/dashboard-teaches-query.dto';
import {
  DashboardTeachItemDto,
  DashboardTeachesResponseDto,
} from './dto/dashboard-teaches-response.dto';
import { UpdateDashboardTeachDto } from './dto/update-dashboard-teach.dto';

const teachInclude = {
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
  course: { select: { id: true, title: true, schoolId: true } },
  year: { select: { id: true, title: true, isCurrent: true, schoolId: true } },
} as const;

type TeachRecord = {
  id: number;
  teacherId: number;
  sectionId: number;
  courseId: number;
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
  course: { id: number; title: string; schoolId: number };
  year: { id: number; title: string; isCurrent: boolean; schoolId: number };
};

@Injectable()
export class DashboardTeachesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTeaches(
    user: AuthenticatedSchool,
    query: DashboardTeachesQueryDto,
  ): Promise<DashboardTeachesResponseDto> {
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
      this.prisma.teach.count({ where }),
      this.prisma.teach.findMany({
        where,
        include: teachInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toItem(row as unknown as TeachRecord)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getTeach(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardTeachItemDto> {
    return this.toItem(await this.findVisible(user.schoolId, id));
  }

  async createTeach(
    user: AuthenticatedSchool,
    dto: CreateDashboardTeachDto,
  ): Promise<DashboardTeachItemDto> {
    const section = await this.assertSection(user.schoolId, dto.sectionId);
    const yearId = dto.yearId ?? section.yearId;
    if (yearId !== section.yearId) {
      throw new BadRequestException(
        'Year must match the selected section year',
      );
    }
    await this.assertYear(user.schoolId, yearId);
    await this.assertTeacher(user.schoolId, dto.teacherId);
    await this.assertCourse(user.schoolId, dto.courseId);
    await this.assertUnique(dto.sectionId, dto.courseId, yearId);

    const row = await this.prisma.teach.create({
      data: {
        teacherId: dto.teacherId,
        sectionId: dto.sectionId,
        courseId: dto.courseId,
        yearId,
      },
      include: teachInclude,
    });
    return this.toItem(row as unknown as TeachRecord);
  }

  async updateTeach(
    user: AuthenticatedSchool,
    id: number,
    dto: UpdateDashboardTeachDto,
  ): Promise<DashboardTeachItemDto> {
    const existing = await this.findVisible(user.schoolId, id);
    const sectionId = dto.sectionId ?? existing.sectionId;
    const teacherId = dto.teacherId ?? existing.teacherId;
    const courseId = dto.courseId ?? existing.courseId;
    const section = await this.assertSection(user.schoolId, sectionId);
    const yearId = dto.yearId ?? section.yearId;
    if (yearId !== section.yearId) {
      throw new BadRequestException(
        'Year must match the selected section year',
      );
    }
    await this.assertYear(user.schoolId, yearId);
    await this.assertTeacher(user.schoolId, teacherId);
    await this.assertCourse(user.schoolId, courseId);
    await this.assertUnique(sectionId, courseId, yearId, id);

    const row = await this.prisma.teach.update({
      where: { id },
      data: { teacherId, sectionId, courseId, yearId },
      include: teachInclude,
    });
    return this.toItem(row as unknown as TeachRecord);
  }

  async deleteTeach(user: AuthenticatedSchool, id: number): Promise<void> {
    await this.findVisible(user.schoolId, id);
    await this.prisma.teach.delete({ where: { id } });
  }

  private async findVisible(
    schoolId: number,
    id: number,
  ): Promise<TeachRecord> {
    const row = await this.prisma.teach.findFirst({
      where: {
        id,
        year: { schoolId },
        section: { schoolId },
        course: { schoolId },
        teacher: { schools: { some: { schoolId, isActive: true } } },
      },
      include: teachInclude,
    });
    if (!row) {
      throw new NotFoundException('Teach assignment not found');
    }
    return row as unknown as TeachRecord;
  }

  private toItem(row: TeachRecord): DashboardTeachItemDto {
    return {
      id: row.id,
      teacherId: row.teacherId,
      teacherName: this.formatName(row.teacher.person),
      classId: row.section.classId,
      className: row.section.class.className,
      sectionId: row.sectionId,
      sectionTitle: row.section.sectionTitle.title,
      courseId: row.courseId,
      courseTitle: row.course.title,
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

  private async assertCourse(
    schoolId: number,
    courseId: number,
  ): Promise<void> {
    const item = await this.prisma.course.findFirst({
      where: { id: courseId, schoolId },
      select: { id: true },
    });
    if (!item) {
      throw new BadRequestException('Course not found');
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
    sectionId: number,
    courseId: number,
    yearId: number,
    excludeId?: number,
  ): Promise<void> {
    const clash = await this.prisma.teach.findFirst({
      where: {
        sectionId,
        courseId,
        yearId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(
        'This section already has a teacher for that course this year',
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
    query: DashboardTeachesQueryDto,
  ): Prisma.TeachWhereInput {
    const search = query.search?.trim();
    return {
      year: { schoolId },
      course: { schoolId },
      teacher: { schools: { some: { schoolId, isActive: true } } },
      section: {
        schoolId,
        ...(query.classId ? { classId: query.classId } : {}),
      },
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.yearId ? { yearId: query.yearId } : {}),
      ...(search
        ? {
            OR: [
              {
                teacher: {
                  person: {
                    OR: [
                      { firstName: { contains: search, mode: 'insensitive' } },
                      { middleName: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
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
              { course: { title: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    sortBy?: DashboardTeachesQueryDto['sortBy'],
    sortOrder?: DashboardTeachesQueryDto['sortOrder'],
  ): Prisma.TeachOrderByWithRelationInput[] {
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
    if (sortBy === 'course') {
      return [{ course: { title: direction } }, { id: direction }];
    }
    if (sortBy === 'year') {
      return [{ year: { title: direction } }, { id: direction }];
    }
    return [{ id: direction }];
  }
}
