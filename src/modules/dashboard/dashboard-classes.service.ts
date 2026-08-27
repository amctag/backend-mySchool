import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DashboardClassItemDto } from './dto/dashboard-class-item.dto';

type ClassRecord = {
  id: number;
  className: string;
  classLevel: number;
  position: number;
  stageId: number;
  stage: { title: string };
  sections: { _count: { registrations: number } }[];
};

@Injectable()
export class DashboardClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async listClasses(
    user: AuthenticatedSchool,
  ): Promise<DashboardClassItemDto[]> {
    const yearId = await this.currentYearId(user.schoolId);
    const classes = await this.prisma.class.findMany({
      where: { stage: { schoolId: user.schoolId } },
      select: this.classSelect(user.schoolId, yearId),
      orderBy: [
        { stage: { position: 'asc' } },
        { position: 'asc' },
        { classLevel: 'asc' },
      ],
    });

    return classes.map((item) => this.toItem(item));
  }

  async getClass(
    user: AuthenticatedSchool,
    classId: number,
  ): Promise<DashboardClassItemDto> {
    const yearId = await this.currentYearId(user.schoolId);
    const item = await this.prisma.class.findFirst({
      where: {
        id: classId,
        stage: { schoolId: user.schoolId },
      },
      select: this.classSelect(user.schoolId, yearId),
    });

    if (!item) {
      throw new NotFoundException('Class not found');
    }

    return this.toItem(item);
  }

  private classSelect(schoolId: number, yearId: number | null) {
    return {
      id: true,
      className: true,
      classLevel: true,
      position: true,
      stageId: true,
      stage: { select: { title: true, position: true } },
      sections: {
        where: {
          schoolId,
          ...(yearId ? { yearId } : {}),
        },
        select: {
          _count: {
            select: {
              registrations: { where: { status: true } },
            },
          },
        },
      },
    } as const;
  }

  private async currentYearId(schoolId: number): Promise<number | null> {
    const year = await this.prisma.year.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });
    return year?.id ?? null;
  }

  private toItem(item: ClassRecord): DashboardClassItemDto {
    const studentCount = item.sections.reduce(
      (total, section) => total + section._count.registrations,
      0,
    );

    return {
      id: item.id,
      className: item.className,
      classLevel: item.classLevel,
      position: item.position,
      stageId: item.stageId,
      stageTitle: item.stage.title,
      studentCount,
    };
  }
}
