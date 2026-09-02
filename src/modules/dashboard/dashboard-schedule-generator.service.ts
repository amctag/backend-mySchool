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

/** All schedule-generator data uses the school's current year. */
async function resolveYearId(
  prisma: PrismaService,
  schoolId: number,
): Promise<number> {
  const year = await prisma.year.findFirst({
    where: { schoolId, isCurrent: true },
    select: { id: true },
  });
  if (!year) {
    throw new BadRequestException('Current year not found for this school');
  }
  return year.id;
}

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

    const yearId = await resolveYearId(this.prisma, schoolId);

    if (query.sectionId) {
      const classRow = await this.prisma.class.findFirst({
        where: {
          id: query.sectionId,
          stage: { schoolId },
        },
        select: { id: true },
      });
      if (!classRow) {
        throw new BadRequestException('Class not found for this school');
      }
    }

    const classFilter = query.sectionId ? { classId: query.sectionId } : {};

    const [teaches, classCourses] = await Promise.all([
      this.prisma.teach.findMany({
        where: {
          yearId,
          year: { schoolId },
          course: { schoolId },
          section: {
            schoolId,
            yearId,
            ...classFilter,
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
            ...(query.sectionId ? { id: query.sectionId } : {}),
            sections: {
              some: {
                schoolId,
                yearId,
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
