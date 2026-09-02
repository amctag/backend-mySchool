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

    const [teaches, classCourses] = await Promise.all([
      this.prisma.teach.findMany({
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
        include: {
          teacher: {
            select: {
              person: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                },
              },
            },
          },
          section: {
            select: {
              classId: true,
              class: { select: { className: true } },
              sectionTitle: { select: { title: true } },
            },
          },
          course: { select: { id: true, title: true } },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.classCourse.findMany({
        where: {
          yearId,
          status: true,
          class: {
            stage: { schoolId },
            sections: {
              some: {
                schoolId,
                yearId,
                ...sectionFilter,
              },
            },
          },
        },
        select: {
          classId: true,
          courseId: true,
          numberOfHours: true,
        },
      }),
    ]);

    const weeklyHoursByClassCourse = new Map<string, number | null>();
    for (const item of classCourses) {
      weeklyHoursByClassCourse.set(
        `${item.classId}:${item.courseId}`,
        item.numberOfHours,
      );
    }

    const objects: ScheduleGeneratorObjectDto[] = teaches.map((item) => {
      const weeklyHours = weeklyHoursByClassCourse.get(
        `${item.section.classId}:${item.courseId}`,
      );

      return {
        id: String(item.id),
        prof: {
          id: String(item.teacherId),
          name: this.formatPersonName(item.teacher.person),
        },
        section: {
          id: String(item.sectionId),
          name: item.section.sectionTitle.title,
          class_id: String(item.section.classId),
          class_name: item.section.class.className,
        },
        matiere: {
          id: String(item.courseId),
          name: item.course.title,
        },
        year_id: String(item.yearId),
        weekly_hours:
          weeklyHours === null || weeklyHours === undefined
            ? null
            : String(weeklyHours),
      };
    });

    return {
      success: true,
      objects,
    };
  }

  private formatPersonName(person: {
    firstName: string;
    middleName: string;
    lastName: string;
  }): string {
    return [person.firstName, person.middleName, person.lastName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');
  }
}
