import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardGradeFormDto } from './dto/create-dashboard-grade-form.dto';
import { DashboardGradeFormClassesCoursesResponseDto } from './dto/dashboard-grade-form-classes-courses-response.dto';
import { DashboardGradeFormsQueryDto } from './dto/dashboard-grade-forms-query.dto';
import {
  DashboardGradeFormDetailDto,
  DashboardGradeFormItemDto,
  DashboardGradeFormsResponseDto,
} from './dto/dashboard-grade-forms-response.dto';
import { DashboardGradeFormDetailsListResponseDto } from './dto/dashboard-grade-form-details-response.dto';
import { DashboardGradeFormByClassResponseDto } from './dto/dashboard-grade-form-by-class-response.dto';
import { SaveDashboardGradeFormDetailDto } from './dto/save-dashboard-grade-form-detail.dto';
import { UpdateDashboardGradeFormClassesDto } from './dto/update-dashboard-grade-form-classes.dto';
import { UpdateDashboardGradeFormDto } from './dto/update-dashboard-grade-form.dto';

const gradeFormInclude = {
  year: { select: { id: true, title: true } },
  classes: {
    include: {
      class: { select: { id: true, className: true } },
    },
    orderBy: [{ class: { className: 'asc' } }],
  },
} satisfies Prisma.GradeFormInclude;

type GradeFormRecord = Prisma.GradeFormGetPayload<{
  include: typeof gradeFormInclude;
}>;

@Injectable()
export class DashboardGradeFormsService {
  constructor(private readonly prisma: PrismaService) {}

  async listGradeForms(
    user: AuthenticatedSchool,
    query: DashboardGradeFormsQueryDto,
  ): Promise<DashboardGradeFormsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const yearId =
      query.yearId ?? (await this.currentYearId(user.schoolId)) ?? undefined;
    const where = this.buildWhere(user.schoolId, { ...query, yearId });
    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.gradeForm.count({ where }),
      this.prisma.gradeForm.findMany({
        where,
        include: {
          ...gradeFormInclude,
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

  async getGradeForm(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardGradeFormDetailDto> {
    const row = await this.findGradeFormForSchool(user.schoolId, id);
    const detailCount = await this.prisma.gradeFormDetail.count({
      where: { gradeFormId: id },
    });
    return this.toFormDetail(row, detailCount);
  }

  async getGradeFormByClass(
    user: AuthenticatedSchool,
    classId: number,
    yearId: number,
  ): Promise<DashboardGradeFormByClassResponseDto> {
    await this.assertClassesForSchool(user.schoolId, [classId]);
    await this.assertYearForSchool(user.schoolId, yearId);

    const row = await this.prisma.gradeForm.findFirst({
      where: {
        schoolId: user.schoolId,
        yearId,
        status: true,
        classes: { some: { classId } },
      },
      include: gradeFormInclude,
      orderBy: [{ id: 'desc' }],
    });

    if (!row) {
      return { gradeForm: null, details: [] };
    }

    const details = await this.prisma.gradeFormDetail.findMany({
      where: {
        gradeFormId: row.id,
        status: true,
        isVisible: true,
      },
      include: { gradeType: { select: { title: true } } },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });

    const detailCount = details.length;

    return {
      gradeForm: this.toFormDetail(row, detailCount),
      details: details.map((item) => this.toDetailRow(item)),
    };
  }

  async createGradeForm(
    user: AuthenticatedSchool,
    body: CreateDashboardGradeFormDto,
  ): Promise<DashboardGradeFormDetailDto> {
    await this.assertYearForSchool(user.schoolId, body.yearId);
    await this.assertClassesForSchool(user.schoolId, body.classIds ?? []);

    const created = await this.prisma.gradeForm.create({
      data: {
        schoolId: user.schoolId,
        title: body.title.trim(),
        yearId: body.yearId,
        gradeBackground: body.gradeBackground?.trim() || null,
        average: body.average ?? true,
        direction: body.direction ?? 'ltr',
        tableFormat: body.tableFormat ?? 'standard',
        gradeFormatId: body.gradeFormatId,
        status: body.status ?? true,
        ...(body.classIds?.length
          ? {
              classes: {
                create: body.classIds.map((classId) => ({ classId })),
              },
            }
          : {}),
      },
      include: gradeFormInclude,
    });

    return this.toFormDetail(created, 0);
  }

  async updateGradeForm(
    user: AuthenticatedSchool,
    id: number,
    body: UpdateDashboardGradeFormDto,
  ): Promise<DashboardGradeFormDetailDto> {
    await this.findGradeFormForSchool(user.schoolId, id);

    if (body.yearId !== undefined) {
      await this.assertYearForSchool(user.schoolId, body.yearId);
    }
    if (body.classIds !== undefined) {
      await this.assertClassesForSchool(user.schoolId, body.classIds);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.gradeForm.update({
        where: { id },
        data: {
          ...(body.title !== undefined ? { title: body.title.trim() } : {}),
          ...(body.yearId !== undefined ? { yearId: body.yearId } : {}),
          ...(body.gradeBackground !== undefined
            ? { gradeBackground: body.gradeBackground.trim() || null }
            : {}),
          ...(body.average !== undefined ? { average: body.average } : {}),
          ...(body.direction !== undefined ? { direction: body.direction } : {}),
          ...(body.tableFormat !== undefined
            ? { tableFormat: body.tableFormat }
            : {}),
          ...(body.gradeFormatId !== undefined
            ? { gradeFormatId: body.gradeFormatId }
            : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        },
      });

      if (body.classIds !== undefined) {
        await tx.gradeFormClass.deleteMany({ where: { gradeFormId: id } });
        if (body.classIds.length > 0) {
          await tx.gradeFormClass.createMany({
            data: body.classIds.map((classId) => ({
              gradeFormId: id,
              classId,
            })),
          });
        }
      }
    });

    const detailCount = await this.prisma.gradeFormDetail.count({
      where: { gradeFormId: id },
    });
    const row = await this.findGradeFormForSchool(user.schoolId, id);
    return this.toFormDetail(row, detailCount);
  }

  async deleteGradeForm(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<void> {
    await this.findGradeFormForSchool(user.schoolId, id);
    await this.prisma.gradeForm.delete({ where: { id } });
  }

  async getGradeFormClassesCourses(
    user: AuthenticatedSchool,
    id: number,
    previewClassIds?: number[],
  ): Promise<DashboardGradeFormClassesCoursesResponseDto> {
    const row = await this.findGradeFormForSchool(user.schoolId, id);
    const savedClassIds = row.classes.map((item) => item.classId);
    const activeClassIds = previewClassIds ?? savedClassIds;

    const classes = await this.prisma.class.findMany({
      where: { stage: { schoolId: user.schoolId } },
      select: { id: true, className: true },
      orderBy: [{ position: 'asc' }, { className: 'asc' }],
    });

    const classCourses =
      activeClassIds.length > 0
        ? await this.prisma.classCourse.findMany({
            where: {
              classId: { in: activeClassIds },
              yearId: row.yearId,
              status: true,
            },
            include: {
              course: { select: { id: true, title: true } },
              class: { select: { className: true } },
            },
            orderBy: [{ course: { title: 'asc' } }],
          })
        : [];

    const coursesById = new Map<
      number,
      { courseTitle: string; classNames: Set<string> }
    >();

    for (const item of classCourses) {
      const existing = coursesById.get(item.courseId);
      if (existing) {
        existing.classNames.add(item.class.className);
        continue;
      }
      coursesById.set(item.courseId, {
        courseTitle: item.course.title,
        classNames: new Set([item.class.className]),
      });
    }

    return {
      gradeFormId: row.id,
      title: row.title,
      yearId: row.year.id,
      yearTitle: row.year.title,
      classIds: savedClassIds,
      classes,
      courses: [...coursesById.entries()].map(([courseId, course]) => ({
        courseId,
        courseTitle: course.courseTitle,
        classNames: [...course.classNames].sort((a, b) => a.localeCompare(b)),
      })),
    };
  }

  async updateGradeFormClasses(
    user: AuthenticatedSchool,
    id: number,
    body: UpdateDashboardGradeFormClassesDto,
  ): Promise<DashboardGradeFormClassesCoursesResponseDto> {
    await this.findGradeFormForSchool(user.schoolId, id);
    await this.assertClassesForSchool(user.schoolId, body.classIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.gradeFormClass.deleteMany({ where: { gradeFormId: id } });
      if (body.classIds.length > 0) {
        await tx.gradeFormClass.createMany({
          data: body.classIds.map((classId) => ({
            gradeFormId: id,
            classId,
          })),
        });
      }
    });

    return this.getGradeFormClassesCourses(user, id);
  }

  async listGradeFormDetails(
    user: AuthenticatedSchool,
    gradeFormId: number,
  ): Promise<DashboardGradeFormDetailsListResponseDto> {
    const form = await this.findGradeFormForSchool(user.schoolId, gradeFormId);

    const items = await this.prisma.gradeFormDetail.findMany({
      where: { gradeFormId },
      include: {
        gradeType: { select: { id: true, title: true } },
      },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });

    return {
      gradeFormId: form.id,
      title: form.title,
      items: items.map((item) => this.toDetailRow(item)),
    };
  }

  async createGradeFormDetail(
    user: AuthenticatedSchool,
    gradeFormId: number,
    body: SaveDashboardGradeFormDetailDto,
  ): Promise<DashboardGradeFormDetailsListResponseDto> {
    await this.findGradeFormForSchool(user.schoolId, gradeFormId);
    await this.assertGradeTypeForSchool(user.schoolId, body.gradeTypeId);

    await this.prisma.gradeFormDetail.create({
      data: {
        gradeFormId,
        gradeTypeId: body.gradeTypeId,
        position: body.position ?? 0,
        status: body.status ?? true,
        isVisible: body.isVisible ?? true,
      },
    });

    return this.listGradeFormDetails(user, gradeFormId);
  }

  async updateGradeFormDetail(
    user: AuthenticatedSchool,
    gradeFormId: number,
    detailId: number,
    body: SaveDashboardGradeFormDetailDto,
  ): Promise<DashboardGradeFormDetailsListResponseDto> {
    await this.findGradeFormDetailForSchool(
      user.schoolId,
      gradeFormId,
      detailId,
    );
    await this.assertGradeTypeForSchool(user.schoolId, body.gradeTypeId);

    await this.prisma.gradeFormDetail.update({
      where: { id: detailId },
      data: {
        gradeTypeId: body.gradeTypeId,
        position: body.position ?? 0,
        status: body.status ?? true,
        isVisible: body.isVisible ?? true,
      },
    });

    return this.listGradeFormDetails(user, gradeFormId);
  }

  async deleteGradeFormDetail(
    user: AuthenticatedSchool,
    gradeFormId: number,
    detailId: number,
  ): Promise<DashboardGradeFormDetailsListResponseDto> {
    await this.findGradeFormDetailForSchool(
      user.schoolId,
      gradeFormId,
      detailId,
    );

    await this.prisma.gradeFormDetail.delete({ where: { id: detailId } });

    return this.listGradeFormDetails(user, gradeFormId);
  }

  private async findGradeFormForSchool(
    schoolId: number,
    id: number,
  ): Promise<GradeFormRecord> {
    const row = await this.prisma.gradeForm.findFirst({
      where: { id, schoolId },
      include: gradeFormInclude,
    });

    if (!row) {
      throw new NotFoundException('Grade form not found');
    }

    return row;
  }

  private async findGradeFormDetailForSchool(
    schoolId: number,
    gradeFormId: number,
    detailId: number,
  ) {
    const row = await this.prisma.gradeFormDetail.findFirst({
      where: {
        id: detailId,
        gradeFormId,
        gradeForm: { schoolId },
      },
      include: {
        gradeType: { select: { id: true, title: true } },
      },
    });

    if (!row) {
      throw new NotFoundException('Grade form detail not found');
    }

    return row;
  }

  private async assertGradeTypeForSchool(
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

  private async assertYearForSchool(
    schoolId: number,
    yearId: number,
  ): Promise<void> {
    const year = await this.prisma.year.findFirst({
      where: { id: yearId, schoolId },
      select: { id: true },
    });

    if (!year) {
      throw new BadRequestException('Year not found');
    }
  }

  private async assertClassesForSchool(
    schoolId: number,
    classIds: number[],
  ): Promise<void> {
    if (classIds.length === 0) {
      return;
    }

    const count = await this.prisma.class.count({
      where: {
        id: { in: classIds },
        stage: { schoolId },
      },
    });

    if (count !== classIds.length) {
      throw new BadRequestException('One or more classes were not found');
    }
  }

  private buildWhere(
    schoolId: number,
    query: DashboardGradeFormsQueryDto & { yearId?: number },
  ): Prisma.GradeFormWhereInput {
    const search = query.search?.trim();
    return {
      schoolId,
      ...(query.yearId ? { yearId: query.yearId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { gradeBackground: { contains: search, mode: 'insensitive' } },
              { year: { title: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    sortBy?: DashboardGradeFormsQueryDto['sortBy'],
    sortOrder?: DashboardGradeFormsQueryDto['sortOrder'],
  ): Prisma.GradeFormOrderByWithRelationInput[] {
    const direction = sortOrder === 'asc' ? 'asc' : 'desc';
    const idTieBreaker: Prisma.GradeFormOrderByWithRelationInput = {
      id: 'asc',
    };

    switch (sortBy) {
      case 'title':
        return [{ title: direction }, idTieBreaker];
      case 'year':
        return [{ year: { title: direction } }, idTieBreaker];
      case 'direction':
        return [{ direction: direction }, idTieBreaker];
      case 'tableFormat':
        return [{ tableFormat: direction }, idTieBreaker];
      case 'status':
        return [{ status: direction }, idTieBreaker];
      case 'date':
        return [{ createdAt: direction }, idTieBreaker];
      case 'id':
      default:
        return [{ id: direction }];
    }
  }

  private toListItem(
    row: GradeFormRecord & { _count: { details: number } },
  ): DashboardGradeFormItemDto {
    return {
      id: row.id,
      title: row.title,
      yearId: row.year.id,
      yearTitle: row.year.title,
      gradeBackground: row.gradeBackground,
      average: row.average,
      direction: row.direction,
      tableFormat: row.tableFormat,
      gradeFormatId: row.gradeFormatId,
      status: row.status,
      classNames: row.classes.map((item) => item.class.className),
      detailCount: row._count.details,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDetailRow(row: {
    id: number;
    gradeFormId: number;
    gradeTypeId: number;
    position: number;
    status: boolean;
    isVisible: boolean;
    createdAt: Date;
    updatedAt: Date;
    gradeType: { id: number; title: string };
  }): DashboardGradeFormDetailsListResponseDto['items'][number] {
    return {
      id: row.id,
      gradeFormId: row.gradeFormId,
      gradeTypeId: row.gradeTypeId,
      gradeTypeTitle: row.gradeType.title,
      position: row.position,
      status: row.status,
      isVisible: row.isVisible,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toFormDetail(
    row: GradeFormRecord,
    detailCount: number,
  ): DashboardGradeFormDetailDto {
    return {
      ...this.toListItem({ ...row, _count: { details: detailCount } }),
      classIds: row.classes.map((item) => item.classId),
    };
  }

  private async currentYearId(schoolId: number): Promise<number | null> {
    const year = await this.prisma.year.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });
    return year?.id ?? null;
  }
}
