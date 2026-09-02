import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DashboardScheduleGeneratorQueryDto } from './dto/dashboard-schedule-generator-query.dto';
import {
  DashboardScheduleGeneratorResponseDto,
  ScheduleGeneratorObjectDto,
} from './dto/dashboard-schedule-generator-response.dto';

/** All schedule-generator data is scoped to this year. */
const SCHEDULE_GENERATOR_YEAR_ID = 3;

@Injectable()
export class DashboardScheduleGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async getScheduleGeneratorData(
    query: DashboardScheduleGeneratorQueryDto,
  ): Promise<DashboardScheduleGeneratorResponseDto> {
    const schoolId = query.schoolId;

    const school = await this.prisma.school.findFirst({
      where: { id: schoolId },
      select: { id: true },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    const yearId = SCHEDULE_GENERATOR_YEAR_ID;

    const year = await this.prisma.year.findFirst({
      where: { id: yearId, schoolId },
      select: { id: true },
    });
    if (!year) {
      throw new BadRequestException(
        `Year ${yearId} not found for this school`,
      );
    }

    if (query.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: {
          id: query.sectionId,
          schoolId,
          yearId,
        },
        select: { id: true },
      });
      if (!section) {
        throw new BadRequestException(
          'Section not found for this school and year',
        );
      }
    }

    const sectionFilter = query.sectionId ? { id: query.sectionId } : {};

    const teaches = await this.prisma.teach.findMany({
      where: {
        yearId,
        year: { schoolId },
        course: { schoolId },
        section: {
          schoolId,
          yearId,
          ...sectionFilter,
        },
        teacher: {
          schools: { some: { schoolId, isActive: true } },
        },
      },
      orderBy: { id: 'asc' },
    });

    const objects: ScheduleGeneratorObjectDto[] = teaches.map((item) => ({
      id: String(item.id),
      Prof_id: String(item.teacherId),
      section_id: String(item.sectionId),
      matiere_id: String(item.courseId),
      year_id: String(item.yearId),
    }));

    return {
      success: true,
      objects,
    };
  }
}
