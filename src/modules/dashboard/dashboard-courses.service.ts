import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardClassCourseDto } from './dto/create-dashboard-class-course.dto';
import { CreateDashboardCourseDto } from './dto/create-dashboard-course.dto';
import { DashboardClassCoursesQueryDto } from './dto/dashboard-class-courses-query.dto';
import {
  DashboardClassCourseItemDto,
  DashboardClassCoursesResponseDto,
} from './dto/dashboard-class-courses-response.dto';
import { DashboardCourseItemDto } from './dto/dashboard-course-item.dto';
import { UpdateDashboardClassCourseDto } from './dto/update-dashboard-class-course.dto';
import { UpdateDashboardCourseDto } from './dto/update-dashboard-course.dto';

const classCourseInclude = {
  class: { select: { id: true, className: true } },
  course: { select: { id: true, title: true } },
  year: { select: { id: true, title: true, isCurrent: true } },
} as const;

type ClassCourseRecord = {
  id: number;
  classId: number;
  courseId: number;
  yearId: number;
  coefficient: Prisma.Decimal;
  numberOfHours: number | null;
  status: boolean;
  class: { id: number; className: string };
  course: { id: number; title: string };
  year: { id: number; title: string; isCurrent: boolean };
};

@Injectable()
export class DashboardCoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCourses(
    user: AuthenticatedSchool,
    search?: string,
  ): Promise<DashboardCourseItemDto[]> {
    const query = search?.trim();
    const courses = await this.prisma.course.findMany({
      where: {
        schoolId: user.schoolId,
        ...(query
          ? { title: { contains: query, mode: 'insensitive' } }
          : {}),
      },
      include: { _count: { select: { classCourses: true } } },
      orderBy: { title: 'asc' },
    });

    return courses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      status: course.status,
      classCourseCount: course._count.classCourses,
    }));
  }

  async getCourse(
    user: AuthenticatedSchool,
    courseId: number,
  ): Promise<DashboardCourseItemDto> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, schoolId: user.schoolId },
      include: { _count: { select: { classCourses: true } } },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      status: course.status,
      classCourseCount: course._count.classCourses,
    };
  }

  async createCourse(
    user: AuthenticatedSchool,
    dto: CreateDashboardCourseDto,
  ): Promise<DashboardCourseItemDto> {
    const course = await this.prisma.course.create({
      data: {
        schoolId: user.schoolId,
        title: dto.title,
        description: dto.description?.trim() ? dto.description.trim() : null,
        status: dto.status ?? true,
      },
      include: { _count: { select: { classCourses: true } } },
    });
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      status: course.status,
      classCourseCount: course._count.classCourses,
    };
  }

  async updateCourse(
    user: AuthenticatedSchool,
    courseId: number,
    dto: UpdateDashboardCourseDto,
  ): Promise<DashboardCourseItemDto> {
    await this.getCourse(user, courseId);
    const course = await this.prisma.course.update({
      where: { id: courseId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? {
              description: dto.description.trim() ? dto.description.trim() : null,
            }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: { _count: { select: { classCourses: true } } },
    });
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      status: course.status,
      classCourseCount: course._count.classCourses,
    };
  }

  async deleteCourse(
    user: AuthenticatedSchool,
    courseId: number,
  ): Promise<void> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, schoolId: user.schoolId },
      select: {
        id: true,
        _count: {
          select: {
            classCourses: true,
            teaches: true,
            weeklyScheduleDetails: true,
            agendas: true,
            examScheduleDetails: true,
            grades: true,
          },
        },
      },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    const used = Object.values(course._count).some((count) => count > 0);
    if (used) {
      throw new ConflictException(
        'This course is used by classes or other records and cannot be deleted',
      );
    }
    await this.prisma.course.delete({ where: { id: courseId } });
  }

  async listClassCourses(
    user: AuthenticatedSchool,
    query: DashboardClassCoursesQueryDto,
  ): Promise<DashboardClassCoursesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const yearId =
      query.yearId ?? (await this.currentYearId(user.schoolId));
    const where = this.buildClassCourseWhere(user.schoolId, {
      ...query,
      yearId: yearId ?? undefined,
    });
    const orderBy = this.buildClassCourseOrderBy(query.sortBy, query.sortOrder);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.classCourse.count({ where }),
      this.prisma.classCourse.findMany({
        where,
        include: classCourseInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toClassCourseItem(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getClassCourse(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardClassCourseItemDto> {
    return this.toClassCourseItem(await this.findVisibleClassCourse(user.schoolId, id));
  }

  async createClassCourse(
    user: AuthenticatedSchool,
    dto: CreateDashboardClassCourseDto,
  ): Promise<DashboardClassCourseItemDto> {
    const yearId = dto.yearId ?? (await this.requireCurrentYearId(user.schoolId));
    await this.assertClass(user.schoolId, dto.classId);
    await this.assertCourse(user.schoolId, dto.courseId, true);
    await this.assertYear(user.schoolId, yearId);
    await this.assertUniqueClassCourse(dto.classId, dto.courseId, yearId);

    const row = await this.prisma.classCourse.create({
      data: {
        classId: dto.classId,
        courseId: dto.courseId,
        yearId,
        coefficient: dto.coefficient ?? 1,
        numberOfHours: dto.numberOfHours ?? null,
        status: dto.status ?? true,
      },
      include: classCourseInclude,
    });
    return this.toClassCourseItem(row);
  }

  async updateClassCourse(
    user: AuthenticatedSchool,
    id: number,
    dto: UpdateDashboardClassCourseDto,
  ): Promise<DashboardClassCourseItemDto> {
    const existing = await this.findVisibleClassCourse(user.schoolId, id);
    const classId = dto.classId ?? existing.classId;
    const courseId = dto.courseId ?? existing.courseId;
    const yearId = dto.yearId ?? existing.yearId;

    await this.assertClass(user.schoolId, classId);
    await this.assertCourse(user.schoolId, courseId);
    await this.assertYear(user.schoolId, yearId);
    await this.assertUniqueClassCourse(classId, courseId, yearId, id);

    const row = await this.prisma.classCourse.update({
      where: { id },
      data: {
        classId,
        courseId,
        yearId,
        ...(dto.coefficient !== undefined ? { coefficient: dto.coefficient } : {}),
        ...(dto.numberOfHours !== undefined
          ? { numberOfHours: dto.numberOfHours }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: classCourseInclude,
    });
    return this.toClassCourseItem(row);
  }

  async deleteClassCourse(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<void> {
    await this.findVisibleClassCourse(user.schoolId, id);
    await this.prisma.classCourse.delete({ where: { id } });
  }

  private async findVisibleClassCourse(
    schoolId: number,
    id: number,
  ): Promise<ClassCourseRecord> {
    const row = await this.prisma.classCourse.findFirst({
      where: {
        id,
        class: { stage: { schoolId } },
        course: { schoolId },
      },
      include: classCourseInclude,
    });
    if (!row) {
      throw new NotFoundException('Class course not found');
    }
    return row;
  }

  private toClassCourseItem(row: ClassCourseRecord): DashboardClassCourseItemDto {
    return {
      id: row.id,
      classId: row.classId,
      className: row.class.className,
      courseId: row.courseId,
      courseTitle: row.course.title,
      yearId: row.yearId,
      yearTitle: row.year.title,
      isCurrentYear: row.year.isCurrent,
      coefficient: Number(row.coefficient),
      numberOfHours: row.numberOfHours,
      status: row.status,
    };
  }

  private async assertClass(schoolId: number, classId: number): Promise<void> {
    const item = await this.prisma.class.findFirst({
      where: { id: classId, stage: { schoolId } },
      select: { id: true },
    });
    if (!item) {
      throw new BadRequestException('Class not found');
    }
  }

  private async assertCourse(
    schoolId: number,
    courseId: number,
    requireActive = false,
  ): Promise<void> {
    const item = await this.prisma.course.findFirst({
      where: { id: courseId, schoolId },
      select: { id: true, status: true },
    });
    if (!item) {
      throw new BadRequestException('Course not found');
    }
    if (requireActive && !item.status) {
      throw new BadRequestException('Course is inactive');
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

  private async assertUniqueClassCourse(
    classId: number,
    courseId: number,
    yearId: number,
    excludeId?: number,
  ): Promise<void> {
    const clash = await this.prisma.classCourse.findFirst({
      where: {
        classId,
        courseId,
        yearId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(
        'This class already has that course for this year',
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

  private async requireCurrentYearId(schoolId: number): Promise<number> {
    const yearId = await this.currentYearId(schoolId);
    if (!yearId) {
      throw new BadRequestException('No current school year is set');
    }
    return yearId;
  }

  private buildClassCourseWhere(
    schoolId: number,
    query: DashboardClassCoursesQueryDto,
  ): Prisma.ClassCourseWhereInput {
    const search = query.search?.trim();
    return {
      class: { stage: { schoolId } },
      course: { schoolId },
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.yearId ? { yearId: query.yearId } : {}),
      ...(query.status === 'active' ? { status: true } : {}),
      ...(query.status === 'inactive' ? { status: false } : {}),
      ...(search
        ? {
            OR: [
              { class: { className: { contains: search, mode: 'insensitive' } } },
              { course: { title: { contains: search, mode: 'insensitive' } } },
              { year: { title: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private buildClassCourseOrderBy(
    sortBy?: DashboardClassCoursesQueryDto['sortBy'],
    sortOrder?: DashboardClassCoursesQueryDto['sortOrder'],
  ): Prisma.ClassCourseOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder = sortOrder === 'desc' ? 'desc' : 'asc';
    if (sortBy === 'class') {
      return [{ class: { className: direction } }, { id: direction }];
    }
    if (sortBy === 'course') {
      return [{ course: { title: direction } }, { id: direction }];
    }
    if (sortBy === 'year') {
      return [{ year: { title: direction } }, { id: direction }];
    }
    if (sortBy === 'hours') {
      return [{ numberOfHours: direction }, { id: direction }];
    }
    return [{ id: direction }];
  }
}
