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
import { CreateDashboardTeachDto } from './dto/create-dashboard-teach.dto';
import { DashboardTeachesQueryDto } from './dto/dashboard-teaches-query.dto';
import {
  DashboardTeachCreateResponseDto,
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
  ): Promise<DashboardTeachCreateResponseDto> {
    const courseIds = this.resolveCourseIds(dto);
    const sections = await this.resolveTargetSections(user.schoolId, dto);
    const yearId = dto.yearId ?? sections[0].yearId;
    const classId = sections[0].classId;
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
    await this.assertCoursesForClass(
      user.schoolId,
      classId,
      yearId,
      courseIds,
    );

    const toCreate: { sectionId: number; courseId: number }[] = [];
    for (const section of sections) {
      for (const courseId of courseIds) {
        const clash = await this.prisma.teach.findFirst({
          where: {
            sectionId: section.id,
            courseId,
            yearId,
          },
          select: { id: true, teacherId: true },
        });
        if (!clash) {
          toCreate.push({ sectionId: section.id, courseId });
          continue;
        }
        if (clash.teacherId !== dto.teacherId) {
          throw new ConflictException(
            'This class already has another teacher for that course this year',
          );
        }
      }
    }

    if (toCreate.length === 0) {
      throw new BadRequestException(
        'This teacher already teaches the selected courses in this class',
      );
    }

    const rows = await this.prisma.$transaction(
      toCreate.map((item) =>
        this.prisma.teach.create({
          data: {
            teacherId: dto.teacherId,
            sectionId: item.sectionId,
            courseId: item.courseId,
            yearId,
          },
          include: teachInclude,
        }),
      ),
    );

    return {
      items: rows.map((row) => this.toItem(row as unknown as TeachRecord)),
    };
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

  private async resolveTargetSections(
    schoolId: number,
    dto: CreateDashboardTeachDto,
  ): Promise<{ id: number; yearId: number; classId: number }[]> {
    if (dto.sectionId) {
      const section = await this.assertSection(schoolId, dto.sectionId);
      if (dto.classId && dto.classId !== section.classId) {
        throw new BadRequestException(
          'Section does not belong to the selected class',
        );
      }
      return [{ id: dto.sectionId, yearId: section.yearId, classId: section.classId }];
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

  private async assertCoursesForClass(
    schoolId: number,
    classId: number,
    yearId: number,
    courseIds: number[],
  ): Promise<void> {
    await this.assertCourses(schoolId, courseIds);
    const classCourses = await this.prisma.classCourse.findMany({
      where: {
        classId,
        yearId,
        class: { stage: { schoolId } },
      },
      select: { courseId: true },
    });
    if (classCourses.length === 0) {
      return;
    }
    const allowed = new Set(classCourses.map((item) => item.courseId));
    if (courseIds.some((courseId) => !allowed.has(courseId))) {
      throw new BadRequestException(
        'One or more courses are not assigned to this class',
      );
    }
  }

  private resolveCourseIds(dto: CreateDashboardTeachDto): number[] {
    const ids = [
      ...(dto.courseIds ?? []),
      ...(dto.courseId ? [dto.courseId] : []),
    ];
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      throw new BadRequestException(
        'Provide courseId or courseIds so the teacher can be assigned to courses',
      );
    }
    return unique;
  }

  private async assertCourse(
    schoolId: number,
    courseId: number,
  ): Promise<void> {
    await this.assertCourses(schoolId, [courseId]);
  }

  private async assertCourses(
    schoolId: number,
    courseIds: number[],
  ): Promise<void> {
    const items = await this.prisma.course.findMany({
      where: { id: { in: courseIds }, schoolId },
      select: { id: true },
    });
    if (items.length !== courseIds.length) {
      throw new BadRequestException('One or more courses were not found');
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
    const teacherNameMatch = personNameContainsFilter(search);
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
