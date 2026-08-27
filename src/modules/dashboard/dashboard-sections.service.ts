import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardSectionDto } from './dto/create-dashboard-section.dto';
import { DashboardSectionsQueryDto } from './dto/dashboard-sections-query.dto';
import {
  DashboardSectionItemDto,
  DashboardSectionTitleItemDto,
  DashboardSectionsResponseDto,
  DashboardYearItemDto,
} from './dto/dashboard-sections-response.dto';
import { UpdateDashboardSectionDto } from './dto/update-dashboard-section.dto';

const sectionInclude = {
  class: { select: { id: true, className: true } },
  sectionTitle: { select: { id: true, title: true } },
  year: { select: { id: true, title: true, isCurrent: true } },
  _count: {
    select: { registrations: { where: { status: true } } },
  },
} as const;

type SectionRecord = {
  id: number;
  classId: number;
  sectionTitleId: number;
  yearId: number;
  status: number;
  class: { id: number; className: string };
  sectionTitle: { id: number; title: string };
  year: { id: number; title: string; isCurrent: boolean };
  _count: { registrations: number };
};

@Injectable()
export class DashboardSectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSections(
    user: AuthenticatedSchool,
    query: DashboardSectionsQueryDto,
  ): Promise<DashboardSectionsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = this.buildWhere(user.schoolId, query);
    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder);

    const [total, sections] = await this.prisma.$transaction([
      this.prisma.section.count({ where }),
      this.prisma.section.findMany({
        where,
        include: sectionInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: sections.map((section) =>
        this.toItem(section as unknown as SectionRecord),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getSection(
    user: AuthenticatedSchool,
    sectionId: number,
  ): Promise<DashboardSectionItemDto> {
    return this.toItem(await this.findVisible(user.schoolId, sectionId));
  }

  async createSection(
    user: AuthenticatedSchool,
    dto: CreateDashboardSectionDto,
  ): Promise<DashboardSectionItemDto> {
    const yearId = dto.yearId ?? (await this.requireCurrentYearId(user.schoolId));
    await this.assertClass(user.schoolId, dto.classId);
    await this.assertSectionTitle(user.schoolId, dto.sectionTitleId);
    await this.assertYear(user.schoolId, yearId);
    await this.assertUnique(
      user.schoolId,
      dto.classId,
      dto.sectionTitleId,
      yearId,
    );

    const section = await this.prisma.section.create({
      data: {
        schoolId: user.schoolId,
        classId: dto.classId,
        sectionTitleId: dto.sectionTitleId,
        yearId,
        status: dto.status ?? 1,
      },
      include: sectionInclude,
    });

    return this.toItem(section as unknown as SectionRecord);
  }

  async updateSection(
    user: AuthenticatedSchool,
    sectionId: number,
    dto: UpdateDashboardSectionDto,
  ): Promise<DashboardSectionItemDto> {
    const existing = await this.findVisible(user.schoolId, sectionId);
    const classId = dto.classId ?? existing.classId;
    const sectionTitleId = dto.sectionTitleId ?? existing.sectionTitleId;
    const yearId = dto.yearId ?? existing.yearId;

    if (dto.classId !== undefined) {
      await this.assertClass(user.schoolId, classId);
    }
    if (dto.sectionTitleId !== undefined) {
      await this.assertSectionTitle(user.schoolId, sectionTitleId);
    }
    if (dto.yearId !== undefined) {
      await this.assertYear(user.schoolId, yearId);
    }

    await this.assertUnique(
      user.schoolId,
      classId,
      sectionTitleId,
      yearId,
      sectionId,
    );

    const section = await this.prisma.section.update({
      where: { id: sectionId },
      data: {
        classId,
        sectionTitleId,
        yearId,
        status: dto.status ?? existing.status,
      },
      include: sectionInclude,
    });

    return this.toItem(section as unknown as SectionRecord);
  }

  listYears(user: AuthenticatedSchool): Promise<DashboardYearItemDto[]> {
    return this.prisma.year.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true, title: true, isCurrent: true },
      orderBy: [{ isCurrent: 'desc' }, { title: 'desc' }],
    });
  }

  listSectionTitles(
    user: AuthenticatedSchool,
  ): Promise<DashboardSectionTitleItemDto[]> {
    return this.prisma.sectionTitle.findMany({
      where: { schoolId: user.schoolId, status: 1 },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    });
  }

  private async findVisible(
    schoolId: number,
    sectionId: number,
  ): Promise<SectionRecord> {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, schoolId },
      include: sectionInclude,
    });

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    return section as unknown as SectionRecord;
  }

  private async requireCurrentYearId(schoolId: number): Promise<number> {
    const year = await this.prisma.year.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });
    if (!year) {
      throw new BadRequestException('This school has no current year');
    }
    return year.id;
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

  private async assertSectionTitle(
    schoolId: number,
    sectionTitleId: number,
  ): Promise<void> {
    const item = await this.prisma.sectionTitle.findFirst({
      where: { id: sectionTitleId, schoolId },
      select: { id: true },
    });
    if (!item) {
      throw new BadRequestException('Section title not found');
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
    schoolId: number,
    classId: number,
    sectionTitleId: number,
    yearId: number,
    excludeId?: number,
  ): Promise<void> {
    const clash = await this.prisma.section.findFirst({
      where: {
        schoolId,
        classId,
        sectionTitleId,
        yearId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(
        'This class already has that section for this year',
      );
    }
  }

  private toItem(section: SectionRecord): DashboardSectionItemDto {
    return {
      id: section.id,
      classId: section.classId,
      className: section.class.className,
      sectionTitleId: section.sectionTitleId,
      sectionTitle: section.sectionTitle.title,
      yearId: section.yearId,
      yearTitle: section.year.title,
      isCurrentYear: section.year.isCurrent,
      status: section.status,
      studentCount: section._count.registrations,
    };
  }

  private buildWhere(
    schoolId: number,
    query: DashboardSectionsQueryDto,
  ): Prisma.SectionWhereInput {
    const search = query.search?.trim();
    return {
      schoolId,
      ...(query.classId ? { classId: query.classId } : {}),
      ...(search
        ? {
            OR: [
              { class: { className: { contains: search, mode: 'insensitive' } } },
              {
                sectionTitle: {
                  title: { contains: search, mode: 'insensitive' },
                },
              },
              { year: { title: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    sortBy?: DashboardSectionsQueryDto['sortBy'],
    sortOrder?: DashboardSectionsQueryDto['sortOrder'],
  ): Prisma.SectionOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder = sortOrder === 'desc' ? 'desc' : 'asc';
    const idTieBreaker: Prisma.SectionOrderByWithRelationInput = {
      id: direction,
    };

    if (sortBy === 'class') {
      return [{ class: { className: direction } }, idTieBreaker];
    }
    if (sortBy === 'section') {
      return [{ sectionTitle: { title: direction } }, idTieBreaker];
    }
    if (sortBy === 'year') {
      return [{ year: { title: direction } }, idTieBreaker];
    }
    if (sortBy === 'students') {
      return [{ registrations: { _count: direction } }, idTieBreaker];
    }
    return [{ id: direction }];
  }
}
