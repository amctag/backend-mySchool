import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ensureStandardClassesForSchool } from '../../database/standard-classes';
import { DashboardClassItemDto, DashboardStageItemDto } from './dto/dashboard-class-item.dto';
import { DashboardClassesQueryDto } from './dto/dashboard-classes-query.dto';
import { DashboardClassesResponseDto } from './dto/dashboard-classes-response.dto';

type ClassRecord = {
  id: number;
  className: string;
  classLevel: number;
  position: number;
  stageId: number;
  stage: { title: string };
};

@Injectable()
export class DashboardClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async listClasses(
    user: AuthenticatedSchool,
    query: DashboardClassesQueryDto,
  ): Promise<DashboardClassesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim();
    const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
    await ensureStandardClassesForSchool(this.prisma, user.schoolId);
    const where: Prisma.ClassWhereInput = {
      stage: {
        schoolId: user.schoolId,
        ...(query.stageId ? { id: query.stageId } : {}),
      },
      ...(search
        ? { className: { contains: search, mode: 'insensitive' } }
        : {}),
    };

    const [total, classes] = await this.prisma.$transaction([
      this.prisma.class.count({ where }),
      this.prisma.class.findMany({
        where,
        select: this.classSelect,
        orderBy: [{ position: sortOrder }, { className: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: classes.map((item) => this.toItem(item as ClassRecord)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async listStages(
    user: AuthenticatedSchool,
  ): Promise<DashboardStageItemDto[]> {
    await ensureStandardClassesForSchool(this.prisma, user.schoolId);
    return this.prisma.stage.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true, title: true, position: true },
      orderBy: { position: 'asc' },
    });
  }

  async getClass(
    user: AuthenticatedSchool,
    classId: number,
  ): Promise<DashboardClassItemDto> {
    const item = await this.prisma.class.findFirst({
      where: {
        id: classId,
        stage: { schoolId: user.schoolId },
      },
      select: this.classSelect,
    });

    if (!item) {
      throw new NotFoundException('Class not found');
    }

    return this.toItem(item);
  }

  private readonly classSelect = {
    id: true,
    className: true,
    classLevel: true,
    position: true,
    stageId: true,
    stage: { select: { title: true } },
  } as const;

  private toItem(item: ClassRecord): DashboardClassItemDto {
    return {
      id: item.id,
      className: item.className,
      classLevel: item.classLevel,
      position: item.position,
      stageId: item.stageId,
      stageTitle: item.stage.title,
    };
  }
}
