import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DashboardClassItemDto } from './dto/dashboard-class-item.dto';

@Injectable()
export class DashboardClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async listClasses(
    user: AuthenticatedSchool,
  ): Promise<DashboardClassItemDto[]> {
    const classes = await this.prisma.class.findMany({
      where: { stage: { schoolId: user.schoolId } },
      select: {
        id: true,
        className: true,
        classLevel: true,
        position: true,
        stageId: true,
        stage: { select: { title: true, position: true } },
      },
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
    const item = await this.prisma.class.findFirst({
      where: {
        id: classId,
        stage: { schoolId: user.schoolId },
      },
      select: {
        id: true,
        className: true,
        classLevel: true,
        position: true,
        stageId: true,
        stage: { select: { title: true, position: true } },
      },
    });

    if (!item) {
      throw new NotFoundException('Class not found');
    }

    return this.toItem(item);
  }

  private toItem(item: {
    id: number;
    className: string;
    classLevel: number;
    position: number;
    stageId: number;
    stage: { title: string };
  }): DashboardClassItemDto {
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
