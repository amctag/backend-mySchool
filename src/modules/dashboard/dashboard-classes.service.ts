import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DashboardClassItemDto } from './dto/dashboard-class-item.dto';
import { DashboardClassesQueryDto } from './dto/dashboard-classes-query.dto';

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
  ): Promise<DashboardClassItemDto[]> {
    const search = query.search?.trim();
    const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
    const classes = await this.prisma.class.findMany({
      where: {
        stage: { schoolId: user.schoolId },
        ...(search
          ? { className: { contains: search, mode: 'insensitive' } }
          : {}),
      },
      select: this.classSelect,
      orderBy: [{ classLevel: sortOrder }, { className: 'asc' }],
    });

    return classes.map((item) => this.toItem(item));
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
