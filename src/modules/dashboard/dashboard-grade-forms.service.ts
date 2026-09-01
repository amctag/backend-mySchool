import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardGradeFormDto } from './dto/create-dashboard-grade-form.dto';
import { DashboardGradeFormsQueryDto } from './dto/dashboard-grade-forms-query.dto';
import {
  DashboardGradeFormDetailDto,
  DashboardGradeFormItemDto,
  DashboardGradeFormsResponseDto,
} from './dto/dashboard-grade-forms-response.dto';

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
        include: gradeFormInclude,
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
    return this.toDetail(row);
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

    return this.toDetail(created);
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

  private toListItem(row: GradeFormRecord): DashboardGradeFormItemDto {
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
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDetail(row: GradeFormRecord): DashboardGradeFormDetailDto {
    return {
      ...this.toListItem(row),
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
